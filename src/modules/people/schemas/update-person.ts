import { z } from "zod";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { isKnownCountry } from "@/modules/people/domain/countries";

const NAME_MAX = 80;

/**
 * The edit of a person: id, name, and optionally the phone as typed (the use case makes it
 * canonical with `country`, default Lebanon) and the country. An absent phone leaves the phone as it
 * is; an empty one is allowed only for a person who has none.
 */
const updatePersonSchema = z.strictObject({
  personId: z.string().min(1).max(64),
  name: z.string().transform(cleanPersonName).pipe(z.string().min(1).max(NAME_MAX)),
  phone: z.string().max(40).optional(),
  country: z.string().refine(isKnownCountry).optional(),
});

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export function parseUpdatePerson(input: unknown): UpdatePersonInput {
  return updatePersonSchema.parse(input);
}
