import db from "@/lib/db";

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
