"use server";

import { after } from "next/server";
import { alertOwnersOfNewRequest } from "./alert-owners";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import type { PublicRequestResult } from "@/modules/booking/ui/public-request-sheet";
import { actionErrorKey } from "@/lib/use-case-error";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Thin Server Action (Next 16 forms guide). Validate with Zod, no auth this slice, then
 * requestPublicSlot. It answers with a result instead of redirecting, so the request sheet can show
 * the confirmation or a friendly message without leaving the page.
 * after() (next/server) schedules the owner push alert once the response is sent.
 */
export async function submitPublicSlotRequest(formData: FormData): Promise<PublicRequestResult> {
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
    // runs after the response, so it can neither delay it nor change the result.
    after(alertOwnersOfNewRequest);
    return { ok: true };
  } catch (error) {
    // A taken hour was recorded as interest by the use case before it threw.
    return { ok: false, errorKey: await actionErrorKey(error, "submitPublicSlotRequest") };
  }
}
