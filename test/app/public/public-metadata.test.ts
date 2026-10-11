import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { publicPageMetadata } from "@/app/(public)/_components/public-metadata";
import { metadata as ownerMetadata } from "@/app/owner/layout";

const tenant = { name: "ملعب النجمة", address: "Saida, near the corniche", brandPreset: "royal" as const, suspended: false };
const url = "https://najme.lebstads.com/";

describe("publicPageMetadata: a normal stadium", () => {
  const meta = publicPageMetadata({ tenant, locale: "ar", canonicalUrl: url });

  it("titles the page with the name as written and the Arabic call to action, in both languages", () => {
    expect(meta.title).toBe("ملعب النجمة · احجز ملعبك");
    expect(publicPageMetadata({ tenant: { ...tenant, name: "Najme Stadium" }, locale: "en", canonicalUrl: url }).title).toBe(
      "Najme Stadium · احجز ملعبك",
    );
  });

  it("describes the page with the address, or a line with the name when there is none", () => {
    expect(meta.description).toBe("Saida, near the corniche");
    expect(publicPageMetadata({ tenant: { ...tenant, address: "" }, locale: "en", canonicalUrl: url }).description).toBe(
      "Book a pitch at ملعب النجمة.",
    );
  });

  it("is indexable and has a canonical URL", () => {
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe(url);
  });

  it("carries Open Graph and Twitter cards whose image is the generated 512 logo, absolute", () => {
    const image = (meta.openGraph?.images as { url: string }[])[0]!.url;
    expect(image).toMatch(/^https:\/\/najme\.lebstads\.com\/brand\/icon\/512\?v=/);
    expect(meta.openGraph).toMatchObject({ type: "website", title: meta.title, description: meta.description, url, locale: "ar_LB" });
    expect(meta.twitter).toMatchObject({ card: "summary", title: meta.title });
    expect((meta.twitter?.images as string[])[0]).toBe(image);
    expect(publicPageMetadata({ tenant, locale: "en", canonicalUrl: url }).openGraph).toMatchObject({ locale: "en_US" });
  });

  it("falls back to a relative image and no canonical when the base domain is not configured", () => {
    const bare = publicPageMetadata({ tenant, locale: "ar", canonicalUrl: "" });
    expect((bare.openGraph?.images as { url: string }[])[0]!.url).toMatch(/^\/brand\/icon\/512\?v=/);
    expect(bare.alternates).toBeUndefined();
  });
});

describe("publicPageMetadata: a suspended and an unknown host", () => {
  it("a suspended stadium is noindex with no name, address or logo", () => {
    const meta = publicPageMetadata({ tenant: { ...tenant, suspended: true }, locale: "ar", canonicalUrl: url });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(JSON.stringify(meta)).not.toContain("النجمة");
  });

  it("an unknown host is noindex and neutral", () => {
    expect(publicPageMetadata({ tenant: null, locale: "en", canonicalUrl: "" })).toEqual({
      robots: { index: false, follow: false },
    });
  });
});

describe("indexing and language", () => {
  it("the owner app stays noindex", () => {
    expect(ownerMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("the root layout sets lang and dir on <html> from the locale", () => {
    const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("lang={htmlLang(locale)}");
    expect(layout).toContain("dir={htmlDir(locale)}");
  });
});
