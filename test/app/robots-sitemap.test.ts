/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { landingMetadata } from "@/app/(marketing)/landing/_components/landing-metadata";
import { generateMetadata as arabicMetadata } from "@/app/(marketing)/landing/page";
import { generateMetadata as englishMetadata } from "@/app/(marketing)/landing/en/page";
import { APP_CONVENTION_NAMES } from "../architecture/rules";

/**
 * Landing slice 3: robots.txt and sitemap.xml by host, and the landing pages indexable while /platform
 * stays noindex. Written, not run when authored.
 */
let mockHeaders = new Headers();
jest.mock("next/headers", () => ({ headers: async () => mockHeaders }));

const saved = { base: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
  process.env.APP_PROTOCOL = "https";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved.base;
  process.env.APP_PROTOCOL = saved.protocol;
});
beforeEach(() => {
  mockHeaders = new Headers();
});

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const robots = async () => (await import("@/app/robots")).default();
const sitemap = async () => (await import("@/app/sitemap")).default();

describe("robots.txt", () => {
  it("on the bare host allows / and names the sitemap, and never mentions platform", async () => {
    mockHeaders = new Headers({ host: "lebstads.test" });
    const result = await robots();
    expect(result).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: "https://lebstads.test/sitemap.xml" });
    expect(JSON.stringify(result)).not.toMatch(/platform/i);
  });

  it("on a stadium's host allows / and disallows /owner/, with no sitemap line", async () => {
    mockHeaders = new Headers({ host: "ahmad.lebstads.test" });
    const result = await robots();
    expect(result).toEqual({ rules: { userAgent: "*", allow: "/", disallow: "/owner/" } });
    expect(result.sitemap).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/platform/i);
  });

  it("on www, an invalid host and a request with no host disallows everything", async () => {
    for (const host of ["www.lebstads.test", "ahmad.attacker.example", "a.b.lebstads.test", ""]) {
      mockHeaders = host ? new Headers({ host }) : new Headers();
      const result = await robots();
      expect([host, result]).toEqual([host, { rules: { userAgent: "*", disallow: "/" } }]);
    }
  });

  it("does not take a stadium's host for the bare host because of X-Forwarded-Host (untrusted)", async () => {
    mockHeaders = new Headers({ host: "ahmad.lebstads.test", "x-forwarded-host": "lebstads.test" });
    expect((await robots()).sitemap).toBeUndefined();
  });
});

describe("sitemap.xml", () => {
  it("on the bare host lists / and /en, each with the ar and en alternates", async () => {
    mockHeaders = new Headers({ host: "lebstads.test" });
    const alternates = { languages: { ar: "https://lebstads.test/", en: "https://lebstads.test/en" } };
    expect(await sitemap()).toEqual([
      { url: "https://lebstads.test/", alternates },
      { url: "https://lebstads.test/en", alternates },
    ]);
  });

  it("is empty on a stadium's host, on www and on an invalid host", async () => {
    for (const host of ["ahmad.lebstads.test", "www.lebstads.test", "ahmad.attacker.example"]) {
      mockHeaders = new Headers({ host });
      expect([host, await sitemap()]).toEqual([host, []]);
    }
  });

  it("robots.ts and sitemap.ts touch no database and no tenant lookup", () => {
    for (const file of ["robots.ts", "sitemap.ts"]) {
      const imports = read("src", "app", file).split(/\r?\n/).filter((line) => /^\s*import\b/.test(line)).join(" ");
      expect([file, /tenant-context|platform-db|@\/lib\/db"|@\/modules\//.test(imports)]).toEqual([file, false]);
    }
  });

  it("robots and sitemap are Next convention names in the app-thin rule", () => {
    expect(APP_CONVENTION_NAMES).toEqual(expect.arrayContaining(["robots", "sitemap"]));
  });
});

describe("indexing", () => {
  it("the landing pages carry no noindex, and keep canonical and hreflang", () => {
    for (const metadata of [arabicMetadata(), englishMetadata(), landingMetadata("ar"), landingMetadata("en")]) {
      expect(metadata.robots).toBeUndefined();
      expect(metadata.alternates?.canonical).toMatch(/^https:\/\/lebstads\.test\/(en)?$/);
      expect(Object.keys(metadata.alternates?.languages ?? {})).toEqual(["ar", "en", "x-default"]);
    }
  });

  it("nothing under src/app/(marketing) says noindex", () => {
    const base = join(process.cwd(), "src", "app", "(marketing)", "landing");
    for (const file of ["page.tsx", join("en", "page.tsx"), join("_components", "landing-metadata.ts")]) {
      expect([file, /noindex|index:\s*false/i.test(readFileSync(join(base, file), "utf8"))]).toEqual([file, false]);
    }
  });

  it("/platform still answers noindex, nofollow and no-store, and its layout still says so", () => {
    const response = proxy(new NextRequest("http://lebstads.test/platform", { headers: { host: "lebstads.test" } }));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(read("src", "app", "(platform)", "platform", "layout.tsx")).toContain("robots: { index: false, follow: false }");
  });
});
