import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { clearRequestStubs, setRequestHeader } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 5: the stadiums list and detail pages send a visitor without a session to the login.
 * The pages are called as functions; the host and cookies come from the shared `next/headers` stub
 * (test/integration/setup-mocks.ts, request-stubs.ts): the bare host and no cookie. A redirect
 * throws NEXT_REDIRECT with its target in the digest. Written, not run when authored.
 */

/** The bare APP_BASE_DOMAIN of the integration setup (setup-env.ts). */
const BARE_HOST = "lebstads.test";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs(); // also clears React.cache, so no session is remembered between tests
  setRequestHeader("host", BARE_HOST);
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
    setRequestHeader("host", "ahmad.lebstads.test");
    const { default: PlatformPage } = await import("@/app/(platform)/platform/page");
    const { default: StadiumPage } = await import("@/app/(platform)/platform/stadiums/[slug]/page");
    await expect(PlatformPage()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(StadiumPage({ params: Promise.resolve({ slug: "x" }) })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
