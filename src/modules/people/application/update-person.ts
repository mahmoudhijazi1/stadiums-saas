import { Prisma } from "@/generated/prisma/client";
import db from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { PEOPLE_EDIT, can } from "@/modules/access/domain/can";
import { DEFAULT_COUNTRY } from "@/modules/people/domain/countries";
import { normalizeName } from "@/modules/people/domain/normalize-name";
import { toCanonicalPhone } from "@/modules/people/domain/phone";
import {
  findPersonById,
  findPersonByPhone,
  updatePerson,
  type PersonProfile,
} from "@/modules/people/infrastructure/persons";
import { parseUpdatePerson } from "@/modules/people/schemas/update-person";

function isPhoneCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return JSON.stringify(error.meta ?? {}).includes("phone");
}

/**
 * Rename a person and/or change their phone. Owner only (`people.edit`), checked before the
 * transaction. The only writer of a Person's name and phone after creation. The phone becomes
 * canonical (`toCanonicalPhone` with the chosen country); a number another person of this stadium
 * already has is refused naming that person, and so is the unique-index race. A saved phone cannot
 * be cleared. No money table is touched.
 */
export async function updatePersonDetails(input: unknown): Promise<PersonProfile> {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, PEOPLE_EDIT)) throw new DomainError("access.not_allowed");
  // Parsed outside the try: a malformed request is a ZodError for the action to map.
  const parsed = parseUpdatePerson(input);

  let attempted: string | undefined;
  try {
    const result = await db.$transaction(async (tx) => {
      const person = await findPersonById(tx, parsed.personId);
      if (!person) throw new DomainError("people.not_found");

      let phone: string | undefined;
      if (parsed.phone !== undefined) {
        const typed = parsed.phone.trim();
        if (typed === "") {
          if (person.phone) throw new DomainError("people.phone_required");
        } else {
          const next = toCanonicalPhone(typed, parsed.country ?? DEFAULT_COUNTRY);
          if (next === null) throw new DomainError("people.phone_invalid");
          if (next !== person.phone) {
            const other = await findPersonByPhone(tx, next);
            if (other && other.id !== person.id) throw new DomainError("people.phone_taken", { name: other.name });
            phone = next;
            attempted = next;
          }
        }
      }

      return updatePerson(tx, {
        personId: person.id,
        name: parsed.name,
        searchName: normalizeName(parsed.name),
        ...(phone !== undefined ? { phone } : {}),
      });
    });
    logger.info(`Person ${parsed.personId} edited`, undefined, {
      useCase: "updatePersonDetails",
      tenantId: await safeTenantId(),
    });
    return result;
  } catch (error) {
    if (attempted !== undefined && isPhoneCollision(error)) {
      // The race: someone took the number between the check and the write. Name them for the owner.
      const other = await findPersonByPhone(db, attempted);
      throw new DomainError("people.phone_taken", { name: other?.name ?? "" });
    }
    return await rethrowUnexpected(error, "Update person failed", "updatePersonDetails");
  }
}
