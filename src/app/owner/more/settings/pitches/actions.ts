"use server";

import { actionErrorKey } from "@/lib/use-case-error";
import { listLivePitchWindows } from "@/modules/booking/application/list-live-pitch-windows";
import { createPitch } from "@/modules/venue/application/create-pitch";
import { updatePitch } from "@/modules/venue/application/update-pitch";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import { field, redirectOwner } from "@/app/owner/form-query";

const PITCH_KEEP = [
  "tenant",
  "name",
  "slotDurationMinutes",
  "defaultPriceUsd",
  "hoursGroupsJson",
  "priceRulesJson",
] as const;

function confirmQuery(errorKey: string): Record<string, string> {
  if (errorKey === "venue.hours_pending") {
    return { needPending: "1" };
  }
  return {};
}

/**
 * Thin create. Zod → createPitch. redirect() outside try/catch
 * (redirect.md: redirect throws). Lands on Settings.
 */
export async function submitCreatePitch(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parsePitchDraft({
      name: field(formData, "name"),
      slotDurationMinutes: field(formData, "slotDurationMinutes"),
      defaultPriceUsd: field(formData, "defaultPriceUsd"),
      hoursGroups: field(formData, "hoursGroupsJson"),
      priceRules: field(formData, "priceRulesJson"),
    });
    await createPitch(parsed);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCreatePitch");
  }
  if (errorKey) {
    redirectOwner("/owner/more/settings/pitches/new", formData, PITCH_KEEP, {
      error: errorKey,
    });
  }
  redirectOwner("/owner/more/settings", formData, ["tenant"], {
    ok: "pitch_created",
  });
}

/**
 * Thin update. listLivePitchWindows → updatePitch. Draft + pending confirm
 * stay on the edit URL so FlashToast can strip error= without hiding the checkbox.
 */
export async function submitUpdatePitch(formData: FormData) {
  const pitchId = field(formData, "pitchId");
  const editPath = `/owner/more/settings/pitches/${pitchId}`;
  let errorKey: string | undefined;
  try {
    const parsed = parsePitchDraft({
      name: field(formData, "name"),
      slotDurationMinutes: field(formData, "slotDurationMinutes"),
      defaultPriceUsd: field(formData, "defaultPriceUsd"),
      hoursGroups: field(formData, "hoursGroupsJson"),
      priceRules: field(formData, "priceRulesJson"),
      confirmPending: field(formData, "confirmPending"),
    });
    const now = new Date();
    const liveBookings = await listLivePitchWindows(pitchId, now);
    await updatePitch({ pitchId, draft: parsed, liveBookings, now });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitUpdatePitch");
  }
  if (errorKey) {
    redirectOwner(editPath, formData, PITCH_KEEP, {
      error: errorKey,
      ...confirmQuery(errorKey),
    });
  }
  redirectOwner("/owner/more/settings", formData, ["tenant"], {
    ok: "pitch_updated",
  });
}
