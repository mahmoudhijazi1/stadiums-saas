import { normalizePhone } from "@/modules/people/domain/phone";
import {
  createPerson,
  findPersonByPhone,
  type PeopleTx,
} from "@/modules/people/infrastructure/persons";

/**
 * Reuse the existing row for this tenant+phone; never overwrite the stored name.
 * Does not open a transaction — Booking's use case owns `$transaction` (DR-001).
 */
export async function findOrCreatePerson(
  tx: PeopleTx,
  input: { name: string; phone: string },
) {
  const phone = normalizePhone(input.phone);
  const existing = await findPersonByPhone(tx, phone);
  if (existing) {
    return existing;
  }
  return createPerson(tx, { name: input.name, phone });
}
