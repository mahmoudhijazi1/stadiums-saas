"use server";

import { redirect } from "next/navigation";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Thin Server Action (Next 16 forms guide: <form action> + FormData).
 * Validate with Zod, no auth this slice, then requestPublicSlot.
 * redirect() must sit outside try/catch (Next redirect docs).
 */
export async function submitPublicSlotRequest(formData: FormData) {
  const parsed = parsePublicSlotRequest({
    name: field(formData, "name"),
    phone: field(formData, "phone"),
    pitchId: field(formData, "pitchId"),
    start: field(formData, "start"),
    end: field(formData, "end"),
  });

  await requestPublicSlot(parsed);

  const next = new URLSearchParams();
  const tenant = field(formData, "tenant");
  const date = field(formData, "date");
  if (tenant) next.set("tenant", tenant);
  if (date) next.set("date", date);
  next.set("received", "1");
  redirect(`/?${next.toString()}`);
}
