import { randomUUID } from "node:crypto";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import type Decimal from "decimal.js";

/**
 * Insert PENDING/PUBLIC with during as tstzrange.
 * Prisma Client has no booking.create (required Unsupported). tenantId must be
 * in this SQL — the query extension does not stamp $executeRaw (SPEC-03 step 3).
 */
export async function insertPendingPublicBooking(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal },
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source", "priceUsd")
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      'PENDING'::"BookingStatus",
      'PUBLIC'::"BookingSource",
      ${price}::decimal
    )
  `;

  return id;
}

/**
 * Requester row: whole game due on this person until split exists (SPEC-03).
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
    },
  });
}
