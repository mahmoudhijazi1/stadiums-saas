import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { loadActivityPage } from "@/app/owner/(app)/money/_components/activity-load";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { createProduct } from "@/modules/shop/application/products";
import { recordWalkInSale } from "@/modules/shop/application/record-walk-in-sale";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { futureBooking, soonBooking } from "./shop-helpers";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * F-2, first step: a ledger row records the payment it was written for. recordPayment writes it, in
 * the payment's transaction; the activity list uses it directly and pairs only the older rows (no
 * paymentId, no backfill) by time; the database allows one ledger row of each source type per payment.
 */
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
});

describe("every collection path writes the payment it came from", () => {
  it("a whole game, a per-player share, a walk-in sale, a tab and an expense each leave one ledger row with its paymentId", async () => {
    const cola = await createProduct({ name: "Cola", priceUsd: "1.50" });

    const whole = await soonBooking(fixture, "Whole");
    await collectBookingPayment({ bookingId: whole, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });

    const split = await futureBooking(fixture, 5, "Split");
    await switchToPerPlayer({ bookingId: split, count: 10 });
    const [first] = await platformDb.bookingParticipant.findMany({
      where: { bookingId: split, slotNumber: { not: null } },
      orderBy: { slotNumber: "asc" },
    });
    await collectSlotPayment({ bookingId: split, participantId: first!.id });

    await recordWalkInSale({ lines: [{ productId: cola.id, qty: 2 }], usdAmount: "3.00" });

    const tab = await addBookingItems({ bookingId: whole, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "game" } });
    await collectTabPayment({ saleId: tab.saleId, usdAmount: "1.50" });

    await recordExpense({
      category: "WATER",
      description: "Water tank",
      occurredOn: "2026-09-10",
      tenders: [{ currency: "USD", amount: new Decimal("12.50") }],
    });

    const payments = await platformDb.payment.findMany({ where: { tenantId: fixture.tenantId } });
    const ledger = await platformDb.ledgerEntry.findMany({ where: { tenantId: fixture.tenantId } });
    expect(payments.map((payment) => payment.sourceType).sort()).toEqual(["BOOKING", "BOOKING", "EXPENSE", "SALE", "SALE"]);
    expect(ledger).toHaveLength(payments.length);
    expect(ledger.filter((row) => row.paymentId === null)).toEqual([]);
    for (const payment of payments) {
      const rows = ledger.filter((row) => row.paymentId === payment.id);
      expect(rows).toHaveLength(1);
      expect([rows[0]!.sourceType, rows[0]!.sourceId, rows[0]!.tenantId]).toEqual([payment.sourceType, payment.sourceId, payment.tenantId]);
    }
    await assertMoneyInvariants([]);
  });

  it("the invariant check catches a ledger row whose dollars differ from its payment's tenders", async () => {
    const booking = await soonBooking(fixture);
    await collectBookingPayment({ bookingId: booking, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });
    await assertMoneyInvariants([]);
    await platformDb.ledgerEntry.updateMany({ where: { sourceId: booking }, data: { amountUsd: "29.00" } });
    await expect(assertMoneyInvariants([])).rejects.toThrow();
  });
});

type Tender = { currency: "USD" | "LBP"; amount: string; rate: string; usd: string };

async function seedPayment(input: { sourceId: string; at: string; tender: Tender }) {
  return platformDb.payment.create({
    data: {
      tenantId: fixture.tenantId,
      sourceType: "BOOKING",
      sourceId: input.sourceId,
      dueCurrency: "USD",
      amountDueUsd: input.tender.usd,
      createdAt: new Date(input.at),
      tenders: {
        create: [
          {
            tenantId: fixture.tenantId,
            currency: input.tender.currency,
            amount: input.tender.amount,
            rateAtTime: input.tender.rate,
            usdEquivalent: input.tender.usd,
          },
        ],
      },
    },
  });
}

async function seedLedger(input: { sourceId: string; at: string; usd: string; paymentId?: string }) {
  return platformDb.ledgerEntry.create({
    data: {
      tenantId: fixture.tenantId,
      direction: "IN",
      amountUsd: input.usd,
      occurredAt: new Date(input.at),
      sourceType: "BOOKING",
      sourceId: input.sourceId,
      ...(input.paymentId ? { paymentId: input.paymentId } : {}),
    },
  });
}

describe("the activity list", () => {
  it("uses paymentId even when the payment's time is far from the ledger row's, and still pairs an old row by time", async () => {
    // Two payments on one game, made on 5 October. Their ledger rows are dated days later and in the
    // opposite order, so pairing by time could not find them (more than five minutes away): only the
    // paymentId says which is which.
    const small = await seedPayment({ sourceId: "b-new", at: "2026-10-05T10:00:00.000Z", tender: { currency: "LBP", amount: "700000", rate: "89500", usd: "7.82" } });
    const large = await seedPayment({ sourceId: "b-new", at: "2026-10-05T10:01:00.000Z", tender: { currency: "LBP", amount: "1300000", rate: "89500", usd: "14.53" } });
    const rowOfLarge = await seedLedger({ sourceId: "b-new", at: "2026-10-20T10:00:00.000Z", usd: "14.53", paymentId: large.id });
    const rowOfSmall = await seedLedger({ sourceId: "b-new", at: "2026-10-21T10:00:00.000Z", usd: "7.82", paymentId: small.id });

    // An older row: no paymentId, paired by time with the payment made at that moment.
    await seedPayment({ sourceId: "b-old", at: "2026-10-22T10:00:00.000Z", tender: { currency: "USD", amount: "20.00", rate: "90000", usd: "20.00" } });
    const oldRow = await seedLedger({ sourceId: "b-old", at: "2026-10-22T10:00:01.000Z", usd: "20.00" });

    const page = await loadActivityPage({ ...OCTOBER, filter: "all" }, "en");
    const textOf = (id: string) => page.rows.find((row) => row.id === id)?.amountText;
    expect(textOf(rowOfLarge.id)).toBe("+1,300,000 LBP");
    expect(textOf(rowOfSmall.id)).toBe("+700,000 LBP");
    expect(textOf(oldRow.id)).toBe("+$20");
  });

  it("an old row never takes a payment that a newer row names", async () => {
    const payment = await seedPayment({ sourceId: "b-mix", at: "2026-10-05T10:00:00.000Z", tender: { currency: "LBP", amount: "700000", rate: "89500", usd: "7.82" } });
    const named = await seedLedger({ sourceId: "b-mix", at: "2026-10-05T10:00:00.002Z", usd: "7.82", paymentId: payment.id });
    const old = await seedLedger({ sourceId: "b-mix", at: "2026-10-05T10:00:30.000Z", usd: "7.82" });

    const page = await loadActivityPage({ ...OCTOBER, filter: "all" }, "en");
    expect(page.rows.find((row) => row.id === named.id)?.amountText).toBe("+700,000 LBP");
    // The old row has no payment left to pair with: it shows the ledger's dollars.
    expect(page.rows.find((row) => row.id === old.id)?.amountText).toBe("+$7.82");
  });
});

describe("the database", () => {
  it("refuses a second ledger row of the same source type for one payment, and allows old rows without a payment to repeat", async () => {
    const payment = await seedPayment({ sourceId: "b-uniq", at: "2026-10-05T10:00:00.000Z", tender: { currency: "USD", amount: "20.00", rate: "90000", usd: "20.00" } });
    await seedLedger({ sourceId: "b-uniq", at: "2026-10-05T10:00:00.000Z", usd: "20.00", paymentId: payment.id });
    await expect(seedLedger({ sourceId: "b-uniq", at: "2026-10-05T10:00:01.000Z", usd: "20.00", paymentId: payment.id })).rejects.toThrow();

    await seedLedger({ sourceId: "b-legacy", at: "2026-10-06T10:00:00.000Z", usd: "5.00" });
    await seedLedger({ sourceId: "b-legacy", at: "2026-10-06T11:00:00.000Z", usd: "5.00" });
    expect(await platformDb.ledgerEntry.count({ where: { sourceId: "b-legacy" } })).toBe(2);
  });

  it("restricts deleting a payment that has a ledger row", async () => {
    const payment = await seedPayment({ sourceId: "b-fk", at: "2026-10-05T10:00:00.000Z", tender: { currency: "USD", amount: "20.00", rate: "90000", usd: "20.00" } });
    await seedLedger({ sourceId: "b-fk", at: "2026-10-05T10:00:00.000Z", usd: "20.00", paymentId: payment.id });
    await platformDb.paymentTender.deleteMany({ where: { paymentId: payment.id } });
    await expect(platformDb.payment.delete({ where: { id: payment.id } })).rejects.toThrow();
  });
});
