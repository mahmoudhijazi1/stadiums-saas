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
 * One pitch in this tenant (id, name, scheduleConfig). Missing / other-tenant → null.
 * Tx-safe: pass the interactive `tx`, or `db` for a top-level call outside `$transaction`.
 * Same select and tx-safety as `findPitchById` (Booking kept that name historically).
 */
export async function findPitch(tx: TenantTx, pitchId: string) {
  return tx.pitch.findUnique({
    where: { id: pitchId },
    select: { id: true, name: true, scheduleConfig: true },
  });
}

export async function insertPitch(input: {
  name: string;
  scheduleConfig: unknown;
}) {
  return db.pitch.create({
    data: {
      name: input.name,
      scheduleConfig: input.scheduleConfig,
    } as Parameters<typeof db.pitch.create>[0]["data"],
    select: { id: true },
  });
}

/** Tx-safe pitch update — pass interactive `tx` or top-level `db`. */
export async function updatePitchRow(
  tx: TenantTx,
  input: {
    pitchId: string;
    name: string;
    scheduleConfig: unknown;
  },
) {
  return tx.pitch.update({
    where: { id: input.pitchId },
    data: {
      name: input.name,
      scheduleConfig: input.scheduleConfig,
    } as Parameters<typeof tx.pitch.update>[0]["data"],
    select: { id: true },
  });
}

/**
 * Alias of `findPitch` for Booking call sites (same fields, same tx-safety).
 * Prefer `findPitch` in new Venue code; keep this name where Booking already imports it.
 */
export async function findPitchById(tx: TenantTx, pitchId: string) {
  return findPitch(tx, pitchId);
}
