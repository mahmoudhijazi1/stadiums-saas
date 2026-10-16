import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/format/money";
import Decimal from "decimal.js";

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
    priceUsd: Decimal;
    requestedName?: string | null;
    /** The weekly series this game belongs to (owner-created series only). */
    seriesId?: string | null;
  },
  status: BookingInsertStatus,
  source: BookingInsertSource,
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" (
      "id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceUsd", "amountDueUsd", "collectionMode", "requestedName", "seriesId"
    )
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      ${status}::"BookingStatus",
      ${source}::"BookingSource",
      'USD'::"Currency",
      ${price}::decimal,
      ${price}::decimal,
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
    priceUsd: Decimal;
    /** Typed name when it differs from the stored Person name (S-6), else null. */
    requestedName?: string | null;
  },
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
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal; seriesId?: string | null },
): Promise<string> {
  return insertBookingDuring(tx, input, "APPROVED", "OWNER");
}

/**
 * Requester row: whole game due on this person until split exists (SPEC-03).
 * Do not pass tenantId — the db extension stamps it (DR-001). Prisma 7’s
 * create XOR still requires tenantId (unchecked) or tenant (checked);
 * `$extends` does not rewrite those input types.
 */
export async function insertRequesterParticipant(
  tx: TenantTx,
  input: { bookingId: string; personId: string; amountDueUsd: Decimal },
) {
  return tx.bookingParticipant.create({
    data: {
      bookingId: input.bookingId,
      personId: input.personId,
      amountDueUsd: formatUsd(input.amountDueUsd),
      isRequester: true,
    } as Parameters<typeof tx.bookingParticipant.create>[0]["data"],
  });
}
