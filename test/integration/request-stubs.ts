/**
 * Mutators for the next/headers mock installed in setup-mocks.ts.
 */
import * as nextHeaders from "next/headers";
import { clearReactCache } from "./setup-mocks";

type Stores = {
  __headerStore: Map<string, string>;
  __cookieStore: Map<string, string>;
  __setCookies: { name: string; value: string; [option: string]: unknown }[];
};

function stores(): Stores {
  return nextHeaders as unknown as Stores;
}

/** The tenant comes from Host (APP_BASE_DOMAIN is lebstads.test in setup-env). */
export function setTenantSlug(slug: string) {
  stores().__headerStore.set("host", `${slug}.lebstads.test`);
}

/** Any request header the code under test reads through next/headers. */
export function setRequestHeader(name: string, value: string) {
  stores().__headerStore.set(name.toLowerCase(), value);
}

export function setSessionCookie(sessionId: string) {
  stores().__cookieStore.set("stadium_session", sessionId);
}

/** Any cookie the code under test reads through next/headers (for example the platform admin's). */
export function setCookie(name: string, value: string) {
  stores().__cookieStore.set(name, value);
}

/** Cookies the code under test wrote or deleted since the last clear. */
export function writtenCookies() {
  return [...stores().__setCookies];
}

export function clearRequestStubs() {
  stores().__headerStore.clear();
  stores().__cookieStore.clear();
  stores().__setCookies.length = 0;
  clearReactCache();
}
