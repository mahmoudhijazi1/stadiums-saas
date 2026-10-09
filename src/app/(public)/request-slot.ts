"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { alertOwnersOfNewRequest } from "./alert-owners";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import { actionErrorKey } from "@/lib/use-case-error";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Thin Server Action (Next 16 forms guide: <form action> + FormData).
 * Validate with Zod, no auth this slice, then requestPublicSlot.
 * redirect() must sit outside try/catch (Next redirect.md: redirect throws).
 * after() (next/server) schedules the owner push alert once the response is sent.
 */
export async function submitPublicSlotRequest(formData: FormData) {
  const date = field(formData, "date");
  let errorKey: string | undefined;
  try {
    const parsed = parsePublicSlotRequest({
      name: field(formData, "name"),
      phone: field(formData, "phone"),
      pitchId: field(formData, "pitchId"),
      start: field(formData, "start"),
      end: field(formData, "end"),
    });
    await requestPublicSlot(parsed);
    // Only a created request gets here (a taken hour throws booking.slot_taken above). The alert
    // runs after the response, so it can neither delay the redirect nor change the result.
    after(alertOwnersOfNewRequest);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitPublicSlotRequest");
    // A taken hour was recorded as interest: say so, not just "taken".
    if (errorKey === "booking.slot_taken") errorKey = "booking.slot_taken_noted";
  }

  const next = new URLSearchParams();
  if (date) next.set("date", date);
  if (errorKey) {
    next.set("error", errorKey);
    redirect(`/?${next.toString()}`);
  }
  next.set("ok", "requested");
  redirect(`/?${next.toString()}`);
}
