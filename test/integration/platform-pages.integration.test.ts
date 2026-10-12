import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 5: the stadiums list and detail pages send a visitor without a session to the login.
 * The pages are called as functions with `next/headers` mocked (the bare host, no cookie); a redirect
 * throws NEXT_REDIRECT with its target in the digest. Written, not run when authored.
 */
let mockHeaders = new Headers({ host: "lebstads.test" });
jest.mock("next/headers", () => ({
  headers: async () => mockHeaders,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  mockHeaders = new Headers({ host: "lebstads.test" });
});

describe("platform pages without a session", () => {
  it("the list redirects to /platform/login", async () => {
    const { default: PlatformPage } = await import("@/app/(platform)/platform/page");
    await expect(PlatformPage()).rejects.toMatchObject({ digest: expect.stringContaining("/platform/login") });
  });

  it("the detail redirects to /platform/login, even for an unknown slug", async () => {
    const { default: StadiumPage } = await import("@/app/(platform)/platform/stadiums/[slug]/page");
    await expect(StadiumPage({ params: Promise.resolve({ slug: "nobody" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("/platform/login"),
    });
  });

  it("both answer 404 off the bare host, before looking at any session", async () => {
    mockHeaders = new Headers({ host: "ahmad.lebstads.test" });
    const { default: PlatformPage } = await import("@/app/(platform)/platform/page");
    const { default: StadiumPage } = await import("@/app/(platform)/platform/stadiums/[slug]/page");
    await expect(PlatformPage()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(StadiumPage({ params: Promise.resolve({ slug: "x" }) })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
