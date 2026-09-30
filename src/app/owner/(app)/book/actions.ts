"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { parseOwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";
import { field, redirectOwner } from "@/app/owner/form-query";

const BOOK_KEEP = ["bookOn"] as const;
const TODAY_KEEP = ["date", "pitch"] as const;

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
  // Booked from the Today free strip: land back on Today, same day.
  const fromToday = field(formData, "returnTo") === "today";
  const path = fromToday ? "/owner/today" : "/owner/book";
  const keep = fromToday ? TODAY_KEEP : BOOK_KEEP;
  if (errorKey) {
    redirectOwner(path, formData, keep, { error: errorKey });
  }
  redirectOwner(path, formData, keep, { ok: "booked" });
}
