/**
 * Mutators for the next/headers mock installed in setup-mocks.ts.
 */
import * as nextHeaders from "next/headers";
import { clearReactCache } from "./setup-mocks";

type Stores = {
  __headerStore: Map<string, string>;
  __cookieStore: Map<string, string>;
};

function stores(): Stores {
  return nextHeaders as unknown as Stores;
}

export function setTenantSlug(slug: string) {
  stores().__headerStore.set("x-tenant-slug", slug);
}

export function setSessionCookie(sessionId: string) {
  stores().__cookieStore.set("stadium_session", sessionId);
}

export function clearRequestStubs() {
  stores().__headerStore.clear();
  stores().__cookieStore.clear();
  clearReactCache();
}
