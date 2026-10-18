import { LBP_UNIT_VALUE } from "@/lib/format/lbp-unit";
import { formatLbpAmount } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";

/**
 * Copy that states the LBP money unit writes `{unit}`; this fills it with the unit and the money
 * formatter ("5,000 LBP" / "5,000 ل.ل"), so the amount is never typed in a sentence (DR-007).
 */
export function withUnit(text: string, locale: UiLocale): string {
  return text.includes("{unit}") ? text.replaceAll("{unit}", formatLbpAmount(String(LBP_UNIT_VALUE), locale)) : text;
}
