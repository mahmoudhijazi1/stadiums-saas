"use server";

import { redirect } from "next/navigation";
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
 */
export async function submitPublicSlotRequest(formData: FormData) {
  const tenant = field(formData, "tenant");
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
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitPublicSlotRequest");
  }

  const next = new URLSearchParams();
  if (tenant) next.set("tenant", tenant);
  if (date) next.set("date", date);
  if (errorKey) {
    next.set("error", errorKey);
    redirect(`/?${next.toString()}`);
  }
  next.set("received", "1");
  redirect(`/?${next.toString()}`);
}
