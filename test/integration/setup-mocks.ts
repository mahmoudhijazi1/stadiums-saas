/**
 * Jest setupFilesAfterEnv — mocks Next request edges for all integration suites.
 *
 * React `cache()` normally lasts the whole Jest process (no per-request reset).
 * We keep memo semantics (needed so getCurrentTenant does not re-hit platformDb
 * inside withCurrentTenant) but expose clearReactCache() for truncate/reseed.
 */

type CacheEntry = { map: Map<string, unknown> };

const reactCaches: CacheEntry[] = [];

export function clearReactCache() {
  for (const entry of reactCaches) {
    entry.map.clear();
  }
}

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      const entry: CacheEntry = { map: new Map() };
      reactCaches.push(entry);
      const wrapped = ((...args: never[]) => {
        const key = JSON.stringify(args);
        if (entry.map.has(key)) {
          return entry.map.get(key);
        }
        const result = fn(...args);
        entry.map.set(key, result);
        return result;
      }) as T;
      return wrapped;
    },
  };
});

jest.mock("next/headers", () => {
  const headerStore = new Map<string, string>();
  const cookieStore = new Map<string, string>();
  /** Every cookie written or deleted by the code under test, in order. */
  const setCookies: { name: string; value: string; [option: string]: unknown }[] = [];

  const api = {
    __headerStore: headerStore,
    __cookieStore: cookieStore,
    __setCookies: setCookies,
    headers: jest.fn(async () => ({
      get(name: string) {
        return headerStore.get(name.toLowerCase()) ?? null;
      },
    })),
    cookies: jest.fn(async () => ({
      get(name: string) {
        const value = cookieStore.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set(
        nameOrOptions: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>,
      ) {
        const cookie =
          typeof nameOrOptions === "string"
            ? { ...options, name: nameOrOptions, value: value ?? "" }
            : { ...nameOrOptions };
        setCookies.push(cookie);
        cookieStore.set(cookie.name, cookie.value);
      },
      delete(name: string) {
        setCookies.push({ name, value: "", deleted: true });
        cookieStore.delete(name);
      },
    })),
  };
  return api;
});
