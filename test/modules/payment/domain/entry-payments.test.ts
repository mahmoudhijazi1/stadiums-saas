import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { keptByEntry, keptParts, type EntryRef, type PaymentRef } from "@/modules/payment/domain/entry-payments";

const at = (iso: string) => new Date(iso);

let nextId = 0;
function payment(over: Partial<PaymentRef> & Pick<PaymentRef, "tenders">): PaymentRef {
  nextId += 1;
  return { id: `p${nextId}`, sourceType: "BOOKING", sourceId: "b1", createdAt: at("2026-10-05T10:00:00.000Z"), ...over };
}
const tender = (currency: "USD" | "LBP", amount: string) => ({ currency, amount: new Decimal(amount) });
const entry = (over: Partial<EntryRef> = {}): EntryRef => ({
  id: "e1",
  sourceType: "BOOKING",
  sourceId: "b1",
  occurredAt: at("2026-10-05T10:00:00.004Z"),
  ...over,
});
const show = (parts: ReturnType<typeof keptParts> | undefined) => parts?.map((p) => `${p.currency}:${p.amount.toFixed(0)}`);

describe("keptParts", () => {
  it("sums each currency on its own and never adds across currencies", () => {
    expect(show(keptParts(payment({ tenders: [tender("USD", "20.00"), tender("LBP", "1500000")] })))).toEqual(["USD:20", "LBP:1500000"]);
    expect(show(keptParts(payment({ tenders: [tender("LBP", "2000000")] })))).toEqual(["LBP:2000000"]);
    expect(show(keptParts(payment({ tenders: [tender("USD", "5.00"), tender("USD", "15.00")] })))).toEqual(["USD:20"]);
  });
});

describe("keptByEntry", () => {
  it("pairs a booking row with the payment of its game made at that time", () => {
    const early = payment({ createdAt: at("2026-10-01T10:00:00.000Z"), tenders: [tender("USD", "10.00")] });
    const late = payment({ tenders: [tender("LBP", "2000000")] });
    const kept = keptByEntry([entry({ id: "late" }), entry({ id: "early", occurredAt: at("2026-10-01T10:00:00.002Z") })], [early, late]);
    expect(show(kept.get("late"))).toEqual(["LBP:2000000"]);
    expect(show(kept.get("early"))).toEqual(["USD:10"]);
  });

  it("an expense is paired with its only payment even when its date is long before it was entered", () => {
    const expense = payment({ sourceType: "EXPENSE", sourceId: "x1", createdAt: at("2026-10-15T09:00:00.000Z"), tenders: [tender("LBP", "300000")] });
    const kept = keptByEntry(
      [entry({ id: "x", sourceType: "EXPENSE", sourceId: "x1", occurredAt: at("2026-09-19T21:00:00.000Z") })],
      [expense],
    );
    expect(show(kept.get("x"))).toEqual(["LBP:300000"]);
  });

  it("a booking row with no payment near its time gets nothing (the screen shows the ledger's dollars)", () => {
    const far = payment({ createdAt: at("2026-10-05T12:00:00.000Z"), tenders: [tender("USD", "10.00")] });
    expect(keptByEntry([entry()], [far]).has("e1")).toBe(false);
    expect(keptByEntry([entry({ sourceId: "other" })], [payment({ tenders: [tender("USD", "10.00")] })]).size).toBe(0);
  });
});

describe("keptByEntry is one-to-one", () => {
  const first = payment({ createdAt: at("2026-10-05T10:00:00.000Z"), tenders: [tender("LBP", "700000")] });
  const second = payment({ createdAt: at("2026-10-05T10:01:00.000Z"), tenders: [tender("LBP", "1300000")] });

  it("two entries whose closest payment is the same one each get a different payment", () => {
    // Both rows are closest to `first`; the nearer row takes it and the other takes `second`.
    const rows = [
      entry({ id: "a", occurredAt: at("2026-10-05T10:00:00.010Z") }),
      entry({ id: "b", occurredAt: at("2026-10-05T10:00:30.000Z") }),
    ];
    const kept = keptByEntry(rows, [first, second]);
    expect(show(kept.get("a"))).toEqual(["LBP:700000"]);
    expect(show(kept.get("b"))).toEqual(["LBP:1300000"]);
  });

  it("pairs by the smallest gap first, whatever order the rows come in", () => {
    const rows = [
      entry({ id: "late", occurredAt: at("2026-10-05T10:01:00.002Z") }),
      entry({ id: "early", occurredAt: at("2026-10-05T10:00:00.001Z") }),
    ];
    for (const ordered of [rows, [...rows].reverse()]) {
      for (const paid of [[first, second], [second, first]]) {
        const kept = keptByEntry(ordered, paid);
        expect(show(kept.get("early"))).toEqual(["LBP:700000"]);
        expect(show(kept.get("late"))).toEqual(["LBP:1300000"]);
      }
    }
  });

  it("more entries than payments: the extra entry falls back and no payment is used twice", () => {
    const rows = [
      entry({ id: "a", occurredAt: at("2026-10-05T10:00:00.001Z") }),
      entry({ id: "b", occurredAt: at("2026-10-05T10:00:20.000Z") }),
    ];
    const kept = keptByEntry(rows, [first]);
    expect(show(kept.get("a"))).toEqual(["LBP:700000"]);
    expect(kept.has("b")).toBe(false);
    expect(kept.size).toBe(1);
  });

  it("a payment outside the limit is never used, even when it is the only one", () => {
    const far = payment({ createdAt: at("2026-10-05T10:06:00.000Z"), tenders: [tender("LBP", "900000")] });
    expect(keptByEntry([entry({ id: "a" })], [far]).size).toBe(0);
    // An expense has no limit.
    const expense = payment({ sourceType: "EXPENSE", sourceId: "x1", createdAt: at("2026-10-20T10:00:00.000Z"), tenders: [tender("LBP", "1")] });
    expect(keptByEntry([entry({ id: "x", sourceType: "EXPENSE", sourceId: "x1" })], [expense]).size).toBe(1);
  });

  it("ties are resolved the same way every time", () => {
    const left = payment({ createdAt: at("2026-10-05T09:59:00.000Z"), tenders: [tender("LBP", "100000")] });
    const right = payment({ createdAt: at("2026-10-05T10:01:00.000Z"), tenders: [tender("LBP", "200000")] });
    const row = entry({ id: "a", occurredAt: at("2026-10-05T10:00:00.000Z") });
    const results = [[left, right], [right, left]].map((paid) => show(keptByEntry([row], paid).get("a")));
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toEqual(["LBP:100000"]);
  });

  it("different sources never share a payment", () => {
    const other = payment({ sourceId: "b2", createdAt: at("2026-10-05T10:00:00.000Z"), tenders: [tender("LBP", "5")] });
    const kept = keptByEntry([entry({ id: "a", sourceId: "b1" })], [other]);
    expect(kept.size).toBe(0);
  });
});

describe("a ledger row that names its payment (F-2)", () => {
  it("uses that payment directly, however far its time is from the row's", () => {
    const small = payment({ createdAt: at("2026-10-05T10:00:00.000Z"), tenders: [tender("LBP", "700000")] });
    const large = payment({ createdAt: at("2026-10-05T10:01:00.000Z"), tenders: [tender("LBP", "1300000")] });
    const kept = keptByEntry(
      [
        entry({ id: "first", occurredAt: at("2026-10-20T10:00:00.000Z"), paymentId: large.id }),
        entry({ id: "second", occurredAt: at("2026-10-21T10:00:00.000Z"), paymentId: small.id }),
      ],
      [small, large],
    );
    expect(show(kept.get("first"))).toEqual(["LBP:1300000"]);
    expect(show(kept.get("second"))).toEqual(["LBP:700000"]);
  });

  it("an old row (no paymentId) is paired by time but never takes a payment a newer row names", () => {
    const only = payment({ tenders: [tender("LBP", "700000")] });
    const kept = keptByEntry(
      [
        entry({ id: "old", occurredAt: at("2026-10-05T10:00:00.001Z") }),
        entry({ id: "named", occurredAt: at("2026-10-05T10:00:30.000Z"), paymentId: only.id }),
      ],
      [only],
    );
    expect(show(kept.get("named"))).toEqual(["LBP:700000"]);
    expect(kept.has("old")).toBe(false);
  });

  it("a paymentId that is not among the payments falls back to pairing by time", () => {
    const near = payment({ tenders: [tender("USD", "10.00")] });
    const kept = keptByEntry([entry({ id: "a", paymentId: "gone" })], [near]);
    expect(show(kept.get("a"))).toEqual(["USD:10"]);
  });
});
