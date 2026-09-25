import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  findPersonById,
  type PersonProfile,
} from "@/modules/people/infrastructure/persons";

/**
 * One person on this tenant. Missing → null (wrong id or another stadium).
 * Same gate as the booking lists: a logged-in membership may look.
 */
export async function getPerson(personId: string): Promise<PersonProfile | null> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  try {
    return await findPersonById(db, personId);
  } catch (error) {
    return await rethrowUnexpected(error, "Get person failed", "getPerson");
  }
}
