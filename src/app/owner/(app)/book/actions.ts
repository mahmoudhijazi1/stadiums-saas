"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { parseOwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";
import { field, redirectOwner } from "@/app/owner/form-query";

const BOOK_KEEP = ["bookOn"] as const;

/**
 * Thin owner Book action. Zod → createOwnerBooking.
 * redirect() outside try/catch (Next redirect docs). Keep bookOn on the query.
 */
export async function submitCreateOwnerBooking(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseOwnerCreateBooking({
      name: field(formData, "name"),
      phone: field(formData, "phone"),
      pitchId: field(formData, "pitchId"),
      start: field(formData, "start"),
      end: field(formData, "end"),
    });
    await createOwnerBooking(parsed);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCreateOwnerBooking");
  }
  if (errorKey) {
    redirectOwner("/owner/book", formData, BOOK_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/book", formData, BOOK_KEEP, { ok: "booked" });
}
