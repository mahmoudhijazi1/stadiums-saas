import type { Person } from "@/app/generated/prisma/client";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { normalizeName } from "@/modules/people/domain/normalize-name";

/**
 * `tx` from `db.$transaction` (tenant-scoped). Never import `db` or `platformDb` here.
 */
export type PeopleTx = TenantTx;

/**
 * Find this tenant's person by already-normalized phone.
 * No tenantId in the where — the tenant extension injects it (DR-001).
 */
export async function findPersonByPhone(
  tx: PeopleTx,
  phone: string,
): Promise<Person | null> {
  return tx.person.findFirst({ where: { phone } });
}

/**
 * Insert a person. tenantId is stamped by the extension, not by this function.
 */
export async function createPerson(
  tx: PeopleTx,
  input: { name: string; phone: string },
): Promise<Person> {
  const name = cleanPersonName(input.name);
  return tx.person.create({
    // Extension stamps tenantId at runtime. Prisma 7 create XOR still wants
    // tenantId or tenant on the type (`$extends` does not rewrite inputs).
    data: {
      name,
      phone: input.phone,
      searchName: normalizeName(name),
    } as Parameters<typeof tx.person.create>[0]["data"],
  });
}

export type PersonProfile = {
  id: string;
  name: string;
  phone: string | null;
};

export async function findPersonById(
  tx: PeopleTx,
  personId: string,
): Promise<PersonProfile | null> {
  const row = await tx.person.findFirst({
    where: { id: personId },
    select: { id: true, name: true, phone: true },
  });
  return row;
}

export type PersonSearchHit = {
  id: string;
  name: string;
  phone: string | null;
};

/**
 * Name contains on searchName, or phone digits contains. Newest name order.
 * Booking activity would require this module to read Booking, so order is the name.
 * Limit 20. tenantId is in the SQL — the extension does not stamp $queryRaw.
 */
export async function searchPersons(
  tx: PeopleTx,
  input: { nameFold: string; phoneDigits: string },
): Promise<PersonSearchHit[]> {
  if (!input.nameFold && !input.phoneDigits) return [];
  const tenantId = await getCurrentTenantId();
  const namePattern = `%${input.nameFold.replace(/[\\%_]/g, "\\$&")}%`;
  const phonePattern = `%${input.phoneDigits}%`;
  return tx.$queryRaw<PersonSearchHit[]>`
    SELECT id, name, phone
    FROM "Person"
    WHERE "tenantId" = ${tenantId}
      AND (
        (${input.nameFold} <> '' AND "searchName" LIKE ${namePattern} ESCAPE '\')
        OR (
          ${input.phoneDigits} <> ''
          AND phone IS NOT NULL
          AND phone LIKE ${phonePattern}
        )
      )
    ORDER BY "searchName" ASC, id ASC
    LIMIT 20
  `;
}
