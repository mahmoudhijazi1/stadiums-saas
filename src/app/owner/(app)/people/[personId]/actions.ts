"use server";

import { revalidatePath } from "next/cache";
import { DomainError } from "@/lib/errors";
import { actionErrorKey } from "@/lib/use-case-error";
import { updatePersonDetails } from "@/modules/people/application/update-person";

export type UpdatePersonResult = { ok: true } | { ok: false; errorKey: string; name?: string };

/**
 * Thin Server Action: the sheet's fields go to the use case, which validates, authorizes
 * (people.edit, owner only) and saves. It answers with a result so the sheet can show the error under
 * its field; `name` is the other person's name for people.phone_taken. Revalidates the person page.
 */
export async function submitUpdatePerson(input: unknown): Promise<UpdatePersonResult> {
  try {
    const person = await updatePersonDetails(input);
    revalidatePath(`/owner/people/${person.id}`);
    return { ok: true };
  } catch (error) {
    const name = error instanceof DomainError ? error.params?.name : undefined;
    return { ok: false, errorKey: await actionErrorKey(error, "submitUpdatePerson"), ...(name ? { name } : {}) };
  }
}
