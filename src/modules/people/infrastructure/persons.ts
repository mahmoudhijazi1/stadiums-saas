import type { Person, Prisma } from "@/app/generated/prisma/client";

/**
 * Prisma interactive-transaction client (Prisma 7 `$transaction` callback).
 * Callers must pass `tx` from `db.$transaction` so tenant scoping and the
 * booking transaction both apply. Never import `db` or `platformDb` here.
 */
export type PeopleTx = Prisma.TransactionClient;

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
  return tx.person.create({
    data: { name: input.name, phone: input.phone },
  });
}
