import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import { formatUsd } from "@/lib/format/money";
import type { GameMoney } from "@/modules/booking/domain/game-money";

/** A game's price: in its currency, or the USD shorthand `priceUsd` (a USD game, as before). */
type PriceInput = { price: GameMoney } | { priceUsd: Decimal };

function priceOf(input: PriceInput): GameMoney {
  return "price" in input ? input.price : { currency: "USD", amount: input.priceUsd };
}

/**
 * A game's money columns in its own currency (DR-007 decision 2): a USD game fills the USD pair and
 * an LBP game the LBP pair, never both (the database CHECKs refuse anything else).
 */
function moneyColumns(price: GameMoney): { currency: "USD" | "LBP"; usd: string | null; lbp: string | null } {
  return price.currency === "LBP"
    ? { currency: "LBP", usd: null, lbp: price.amount.toFixed(0) }
    : { currency: "USD", usd: formatUsd(price.amount), lbp: null };
}

type BookingInsertStatus = "PENDING" | "APPROVED";

type BookingInsertSource = "PUBLIC" | "OWNER";

/**
 * Raw INSERT for Booking.during (Unsupported — no Client create).
 * tenantId in SQL — query extension does not stamp $executeRaw.
 * Callers keep fixed status/source pairs via the named exports below.
 */
async function insertBookingDuring(
  tx: TenantTx,
  input: {
    pitchId: string;
    start: Date;
    end: Date;
    requestedName?: string | null;
    /** The weekly series this game belongs to (owner-created series only). */
    seriesId?: string | null;
  } & PriceInput,
  status: BookingInsertStatus,
  source: BookingInsertSource,
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  // The agreed price, in the stadium's currency; the due starts at the price.
  const money = moneyColumns(priceOf(input));

  await tx.$executeRaw`
    INSERT INTO "Booking" (
      "id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceUsd", "amountDueUsd", "priceLbp", "amountDueLbp",
      "collectionMode", "requestedName", "seriesId"
    )
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      ${status}::"BookingStatus",
      ${source}::"BookingSource",
      ${money.currency}::"Currency",
      ${money.usd}::decimal,
      ${money.usd}::decimal,
      ${money.lbp}::decimal,
      ${money.lbp}::decimal,
      'WHOLE'::"CollectionMode",
      ${input.requestedName ?? null},
      ${input.seriesId ?? null}
    )
  `;

  return id;
}

/**
 * Insert PENDING/PUBLIC with during as tstzrange.
 * Prisma Client has no booking.create (required Unsupported). tenantId must be
 * in this SQL — the query extension does not stamp $executeRaw (SPEC-03 step 3).
 */
export async function insertPendingPublicBooking(
  tx: TenantTx,
  input: {
    pitchId: string;
    start: Date;
    end: Date;
    /** Typed name when it differs from the stored Person name (S-6), else null. */
    requestedName?: string | null;
  } & PriceInput,
): Promise<string> {
  return insertBookingDuring(tx, input, "PENDING", "PUBLIC");
}

/**
 * Insert APPROVED/OWNER with during as tstzrange (SPEC-09).
 * Same raw insert as public PENDING — Client has no booking.create.
 * Hits exclusion when windows overlap another APPROVED.
 */
export async function insertApprovedOwnerBooking(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; seriesId?: string | null } & PriceInput,
): Promise<string> {
  return insertBookingDuring(tx, input, "APPROVED", "OWNER");
}

/**
 * Requester row: whole game due on this person until split exists (SPEC-03), in the game's currency.
 * Do not pass tenantId — the db extension stamps it (DR-001). Prisma 7’s
 * create XOR still requires tenantId (unchecked) or tenant (checked);
 * `$extends` does not rewrite those input types.
 */
export async function insertRequesterParticipant(
  tx: TenantTx,
  input: { bookingId: string; personId: string } & ({ amountDue: GameMoney } | { amountDueUsd: Decimal }),
) {
  const money = moneyColumns("amountDue" in input ? input.amountDue : { currency: "USD", amount: input.amountDueUsd });
  return tx.bookingParticipant.create({
    data: {
      bookingId: input.bookingId,
      personId: input.personId,
      amountDueUsd: money.usd,
      amountDueLbp: money.lbp,
      isRequester: true,
    } as Parameters<typeof tx.bookingParticipant.create>[0]["data"],
  });
}
