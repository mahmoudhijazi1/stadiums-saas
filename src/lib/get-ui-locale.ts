import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseUiLocale, type UiLocale } from "@/lib/locale";

/**
 * Locale from the preference cookie. Default Arabic (DR-005).
 * Next 16: cookies() is async (cookies.md).
 */
export async function getUiLocale(): Promise<UiLocale> {
  return parseUiLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
