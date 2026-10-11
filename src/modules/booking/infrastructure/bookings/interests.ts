import { randomUUID } from "node:crypto";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { asDate, RECENT_WINDOW_MS } from "./_shared";

/**
 * Waitlist row for the approved window (DR-002 §2.13). Raw: no SlotInterest.create (Unsupported).
 */
export async function insertSlotInterest(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; personId: string },
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    INSERT INTO "SlotInterest" ("id", "tenantId", "pitchId", "during", "personId")
    VALUES (
      ${randomUUID()},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      ${input.personId}
    )
  `;
}

/** Does this person already wait on exactly this window? (avoid a duplicate interest) */
export async function hasSlotInterest(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; personId: string },
): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SlotInterest"
    WHERE "tenantId" = ${tenantId}
      AND "pitchId" = ${input.pitchId}
      AND "personId" = ${input.personId}
      AND during = tstzrange(${input.start}, ${input.end}, '[)')
    LIMIT 1
  `;
  return rows.length > 0;
}

export type SlotInterestPersonRow = {
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  personId: string;
  name: string;
  phone: string;
  createdAt: Date;
};

type SlotInterestSqlRow = {
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  personId: string;
  name: string;
  phone: string;
  createdAt: Date | string;
};

/**
 * Waitlist rows for this tenant (SPEC-11). Raw: during is Unsupported.
 * tenantId in SQL (extension does not stamp $queryRaw). Open/closed is domain.
 */
export const SLOT_INTEREST_LIST_MAX = 500;

/** Interests on windows ending after now − 24 h, at most 500 (security audit S-8). */
export async function listSlotInterestsWithPeople(
  tx: TenantTx,
  now: Date = new Date(),
): Promise<SlotInterestPersonRow[]> {
  const tenantId = await getCurrentTenantId();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);
  const rows = await tx.$queryRaw<SlotInterestSqlRow[]>`
    SELECT
      si."pitchId",
      p.name AS "pitchName",
      lower(si.during) AS start,
      upper(si.during) AS end,
      si."personId",
      per.name,
      per.phone,
      si."createdAt"
    FROM "SlotInterest" si
    JOIN "Pitch" p ON p.id = si."pitchId"
    JOIN "Person" per ON per.id = si."personId"
    WHERE si."tenantId" = ${tenantId}
      AND upper(si.during) > ${since}
    ORDER BY lower(si.during) ASC, si."createdAt" ASC
    LIMIT ${SLOT_INTEREST_LIST_MAX}
  `;

  return rows.map((row) => ({
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    personId: row.personId,
    name: row.name,
    phone: row.phone,
    createdAt: asDate(row.createdAt),
  }));
}
