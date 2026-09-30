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

export function setTenantSlug(slug: string) {
  stores().__headerStore.set("x-tenant-slug", slug);
}

/** Any request header the code under test reads through next/headers. */
export function setRequestHeader(name: string, value: string) {
  stores().__headerStore.set(name.toLowerCase(), value);
}

export function setSessionCookie(sessionId: string) {
  stores().__cookieStore.set("stadium_session", sessionId);
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
