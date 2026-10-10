import type { UiLocale } from "@/lib/locale";
import { account } from "./account";
import { common } from "./common";
import { money } from "./money";
import { publicPage } from "./public";
import { requests } from "./requests";
import { settings } from "./settings";
import { shop } from "./shop";
import { today } from "./today";
import type { CopyArea } from "./types";

/**
 * Arabic chrome (DR-005). Keys, not sentences in JSX. Unknown key → the key
 * (missing copy stays visible). Interpolated money/counts are helpers in helpers.ts.
 * Optional English is a second table for the EN/ع toggle — not next-intl.
 */
export const COPY_AREAS: Record<string, CopyArea> = { common, today, requests, money, shop, settings, public: publicPage, account };

const ARABIC: Record<string, string> = Object.assign({}, ...Object.values(COPY_AREAS).map((area) => area.ar));
const ENGLISH: Record<string, string> = Object.assign({}, ...Object.values(COPY_AREAS).map((area) => area.en));

/** Chrome for a key. Default Arabic. Missing English key falls back to Arabic. */
export function ui(key: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return ENGLISH[key] ?? ARABIC[key] ?? key;
  return ARABIC[key] ?? key;
}
