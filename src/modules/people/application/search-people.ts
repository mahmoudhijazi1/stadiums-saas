import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { normalizeName } from "@/modules/people/domain/normalize-name";
import {
  searchPersons,
  type PersonSearchHit,
} from "@/modules/people/infrastructure/persons";

/**
 * Header search. Folded name contains, or phone digits contains. At most 20.
 * Ordered by folded name. A booking-activity sort would read Booking from people.
 */
export async function searchPeople(raw: string): Promise<PersonSearchHit[]> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new DomainError("access.not_allowed");
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    return await searchPersons(db, {
      nameFold: normalizeName(trimmed),
      phoneDigits: trimmed.replace(/\D/g, ""),
    });
  } catch (error) {
    return await rethrowUnexpected(error, "Search people failed", "searchPeople");
  }
}
