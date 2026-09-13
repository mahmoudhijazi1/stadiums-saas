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

export async function findPitch(pitchId: string) {
  return db.pitch.findUnique({
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

export async function updatePitchRow(input: {
  pitchId: string;
  name: string;
  scheduleConfig: unknown;
}) {
  return db.pitch.update({
    where: { id: input.pitchId },
    data: {
      name: input.name,
      scheduleConfig: input.scheduleConfig,
    } as Parameters<typeof db.pitch.update>[0]["data"],
    select: { id: true },
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
