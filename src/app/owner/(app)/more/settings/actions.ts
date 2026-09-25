"use server";

import { parseLbp } from "@/lib/money";
import { parseBookingRulesForm, parseTimeDisplayForm } from "@/lib/tenant-settings";
import { actionErrorKey } from "@/lib/use-case-error";
import { setBookingRules } from "@/modules/access/application/set-booking-rules";
import { setTimeDisplay } from "@/modules/access/application/set-time-display";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";
import { field, redirectOwner } from "@/app/owner/form-query";

const SETTINGS_KEEP = [] as const;

/**
 * Thin action. Zod → setExchangeRate. redirect() outside try/catch
 * (redirect.md: redirect throws). Lands on Settings, not Reports.
 */
export async function submitSetExchangeRate(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseExchangeRate({
      lbpPerUsd: field(formData, "lbpPerUsd"),
    });
    await setExchangeRate(parseLbp(parsed.lbpPerUsd));
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitSetExchangeRate");
  }
  if (errorKey) {
    redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
      error: errorKey,
    });
  }
  redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
    ok: "rate_set",
  });
}

/** Thin action. Zod → setBookingRules. Lands on More. */
export async function submitSetBookingRules(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseBookingRulesForm({
      cancellationWindowHours: field(formData, "cancellationWindowHours"),
      lateCancellationFeePercent: field(formData, "lateCancellationFeePercent"),
      noShowFeePercent: field(formData, "noShowFeePercent"),
    });
    await setBookingRules(parsed);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitSetBookingRules");
  }
  if (errorKey) {
    redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
      error: errorKey,
    });
  }
  redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
    ok: "rules_saved",
  });
}

/** Thin action. Zod → setTimeDisplay. Lands on Settings. */
export async function submitSetTimeDisplay(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseTimeDisplayForm({
      timeDisplay: field(formData, "timeDisplay"),
    });
    await setTimeDisplay(parsed.timeDisplay);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitSetTimeDisplay");
  }
  if (errorKey) {
    redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
      error: errorKey,
    });
  }
  redirectOwner("/owner/more/settings", formData, SETTINGS_KEEP, {
    ok: "time_display_set",
  });
}
