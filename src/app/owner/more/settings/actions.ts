"use server";

import { parseLbp } from "@/lib/money";
import { actionErrorKey } from "@/lib/use-case-error";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";
import { field, redirectOwner } from "@/app/owner/form-query";

const SETTINGS_KEEP = ["tenant"] as const;

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
