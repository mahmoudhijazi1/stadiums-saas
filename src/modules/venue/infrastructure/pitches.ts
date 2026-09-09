import db, { type TenantTx } from "@/lib/db";

/**
 * Venue infrastructure — all Pitch Prisma queries live here.
 * Does NOT pass tenantId; the db tenant extension injects it (SPEC-01).
 */
export async function listPitches() {
  return db.pitch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, scheduleConfig: true },
  });
}

/**
 * One pitch in this tenant. Missing or other-tenant id → null (extension).
 * Takes tx so it stays inside Booking's $transaction (DR-001).
 */
export async function findPitchById(tx: TenantTx, pitchId: string) {
  return tx.pitch.findUnique({
    where: { id: pitchId },
    select: { id: true, name: true, scheduleConfig: true },
  });
}
