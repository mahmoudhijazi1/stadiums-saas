/** @jest-environment node */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

/**
 * /favicon.ico (landing slice 2). Written, not run when authored. The bare host is sent to the static
 * LebStads icon; a stadium's host keeps the redirect to its generated letter logo.
 */
let mockHeaders = new Headers();
let mockIdentity: { symbol: string; preset: string } | null = null;

jest.mock("next/headers", () => ({ headers: async () => mockHeaders }));
jest.mock("../../src/app/brand/current-brand", () => ({ currentBrandIdentity: async () => mockIdentity }));

const savedBase = process.env.APP_BASE_DOMAIN;
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = savedBase;
});
beforeEach(() => {
  mockHeaders = new Headers();
  mockIdentity = null;
});

describe("GET /favicon.ico", () => {
  it("redirects the bare host to the LebStads 32px icon", async () => {
    const { GET } = await import("@/app/favicon.ico/route");
    mockHeaders = new Headers({ host: "lebstads.test" });
    mockIdentity = { symbol: "A", preset: "lime" };
    const response = await GET();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/brand/lebstads/icon-32.png");
  });

  it("redirects a stadium's host to its generated letter logo", async () => {
    const { GET } = await import("@/app/favicon.ico/route");
    mockHeaders = new Headers({ host: "ahmad.lebstads.test" });
    mockIdentity = { symbol: "A", preset: "lime" };
    expect((await GET()).headers.get("location")).toBe("/brand/icon/32?v=41.lime");
  });

  it("gives an unknown or suspended stadium the neutral generated icon", async () => {
    const { GET } = await import("@/app/favicon.ico/route");
    mockHeaders = new Headers({ host: "nobody.lebstads.test" });
    expect((await GET()).headers.get("location")).toBe("/brand/icon/32?v=n");
  });
});
