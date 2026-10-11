import { isCanonicalPhone } from "@/modules/people/domain/phone";
import {
  createPerson,
  findPersonByPhone,
  type PeopleTx,
} from "@/modules/people/infrastructure/persons";

/**
 * Reuse the existing row for this tenant+phone; never overwrite the stored name.
 * The phone must already be canonical (the edge ran toCanonicalPhone); anything else is a
 * programming error, not user input, so it throws.
 * Does not open a transaction — Booking's use case owns `$transaction` (DR-001).
 */
export async function findOrCreatePerson(
  tx: PeopleTx,
  input: { name: string; phone: string },
) {
  const phone = input.phone;
  if (!isCanonicalPhone(phone)) {
    throw new Error("findOrCreatePerson needs a canonical phone (see toCanonicalPhone at the edge)");
  }
  const existing = await findPersonByPhone(tx, phone);
  if (existing) {
    return existing;
  }
  return createPerson(tx, { name: input.name, phone });
}
