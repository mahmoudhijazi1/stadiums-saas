"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_MAX_AGE_SECONDS,
  parseUiLocale,
  type UiLocale,
} from "@/lib/locale";

/**
 * Persist lang/dir. Cookie write only in a Server Function (cookies.md).
 */
export async function setUiLocale(value: string): Promise<UiLocale> {
  const locale = parseUiLocale(value);
  const store = await cookies();
  store.set({
    name: LOCALE_COOKIE,
    value: locale,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCALE_MAX_AGE_SECONDS,
  });
  return locale;
}
