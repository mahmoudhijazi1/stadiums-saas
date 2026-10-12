/** @jest-environment node */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactElement } from "react";

/**
 * The root layout's page language (landing slice 1). Written, not run when authored. On the bare host
 * lang and dir follow x-lebstads-landing when it is "ar" or "en"; everywhere else, and for any other
 * value, they follow the locale cookie as before. generateMetadata links no manifest on the bare host.
 */
let mockHeaders = new Headers();
let mockLocaleCookie: string | undefined;

jest.mock("next/headers", () => ({
  headers: async () => mockHeaders,
  cookies: async () => ({ get: (name: string) => (name === "stadium_locale" && mockLocaleCookie ? { value: mockLocaleCookie } : undefined) }),
}));
jest.mock("@/app/brand/current-brand", () => ({ currentBrandIdentity: async () => null }));
jest.mock("next/font/local", () => ({ __esModule: true, default: () => ({ variable: "", className: "" }) }));

const savedBase = process.env.APP_BASE_DOMAIN;
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = savedBase;
});
beforeEach(() => {
  mockHeaders = new Headers();
  mockLocaleCookie = undefined;
});

async function render() {
  const { default: RootLayout } = await import("@/app/layout");
  const element = (await RootLayout({ children: null } as Parameters<typeof RootLayout>[0])) as ReactElement<{ lang: string; dir: string }>;
  return { lang: element.props.lang, dir: element.props.dir };
}

describe("root layout lang and dir", () => {
  it("follow x-lebstads-landing on the bare host, whatever the cookie says", async () => {
    mockHeaders = new Headers({ host: "lebstads.test", "x-lebstads-landing": "en" });
    mockLocaleCookie = "ar";
    expect(await render()).toEqual({ lang: "en", dir: "ltr" });
    mockHeaders = new Headers({ host: "lebstads.test", "x-lebstads-landing": "ar" });
    mockLocaleCookie = "en";
    expect(await render()).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("follow the locale cookie when the header is absent", async () => {
    mockHeaders = new Headers({ host: "lebstads.test" });
    mockLocaleCookie = "en";
    expect(await render()).toEqual({ lang: "en", dir: "ltr" });
    mockLocaleCookie = undefined;
    expect(await render()).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("ignore a header value that is not ar or en", async () => {
    mockHeaders = new Headers({ host: "lebstads.test", "x-lebstads-landing": "fr" });
    mockLocaleCookie = "en";
    expect(await render()).toEqual({ lang: "en", dir: "ltr" });
  });

  it("ignore the header on a tenant host (the proxy never sets it there)", async () => {
    mockHeaders = new Headers({ host: "ahmad.lebstads.test", "x-lebstads-landing": "en" });
    mockLocaleCookie = "ar";
    expect(await render()).toEqual({ lang: "ar", dir: "rtl" });
  });
});

describe("root layout metadata", () => {
  it("links no manifest on the bare host and leaves the file-convention manifest on a tenant host", async () => {
    const { generateMetadata } = await import("@/app/layout");
    mockHeaders = new Headers({ host: "lebstads.test" });
    expect((await generateMetadata()).manifest).toBeNull();
    mockHeaders = new Headers({ host: "ahmad.lebstads.test" });
    expect((await generateMetadata()).manifest).toBeUndefined();
  });
});
