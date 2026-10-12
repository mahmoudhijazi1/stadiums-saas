import { afterAll, describe, expect, it } from "@jest/globals";
import nextConfig, { landingRewrites } from "../next.config";

/**
 * The landing rewrite lives in next.config.ts (beforeFiles, bare host only), not in the proxy.
 * Written, not run when authored.
 */
const saved = process.env.APP_BASE_DOMAIN;
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved;
});

type Rewrites = { beforeFiles: Array<{ source: string; destination: string; has?: Array<{ type: string; value?: string }> }> };
const beforeFiles = async () => ((await nextConfig.rewrites?.()) as unknown as Rewrites).beforeFiles;

describe("next.config.ts landing rewrites", () => {
  it("has exactly the two bare-host entries, matched on the escaped host without a port", async () => {
    process.env.APP_BASE_DOMAIN = "lebstads.com";
    const has = [{ type: "host", value: "lebstads\\.com" }];
    expect(await beforeFiles()).toEqual([
      { source: "/", destination: "/landing", has },
      { source: "/en", destination: "/landing/en", has },
    ]);
  });

  it("drops a port and lower-cases the host", () => {
    expect(landingRewrites("LocalHost:3000")[0]!.has).toEqual([{ type: "host", value: "localhost" }]);
  });

  it("matches only the bare host, as Next matches it (^value$ on the Host without its port)", () => {
    const value = landingRewrites("lebstads.com")[0]!.has[0]!.value;
    const matches = (host: string) => new RegExp(`^${value}$`).test(host.split(":", 1)[0]!.toLowerCase());
    expect(matches("lebstads.com")).toBe(true);
    expect(matches("lebstads.com:443")).toBe(true);
    expect(matches("ahmad.lebstads.com")).toBe(false);
    expect(matches("www.lebstads.com")).toBe(false);
    expect(matches("lebstadsXcom")).toBe(false);
    expect(matches("lebstads.com.evil.example")).toBe(false);
  });

  it("adds no entry when APP_BASE_DOMAIN is unset or empty (and does not throw)", async () => {
    delete process.env.APP_BASE_DOMAIN;
    expect(await beforeFiles()).toEqual([]);
    process.env.APP_BASE_DOMAIN = "   ";
    expect(await beforeFiles()).toEqual([]);
  });
});
