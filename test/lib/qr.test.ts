/** @jest-environment node */
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "@jest/globals";
import { publicPageUrl } from "@/lib/public-page-url";
import { QR_PNG_SIZE, qrPng, qrSvg } from "@/lib/qr";

/** Decode a PNG buffer back to the text it holds (a real QR reader, jsQR). */
export function decodePng(buffer: Buffer): { text: string | null; width: number; height: number; png: PNG } {
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return { text: result?.data ?? null, width: png.width, height: png.height, png };
}

const URLS = [
  "https://al-nour.lebstads.com/",
  "http://sami.localhost:3000/",
  "https://a-very-long-stadium-name-for-the-slug.lebstads.com/",
];

// Rendering a 1024 px PNG takes about 10 s inside Jest (about 0.1 s in Node), so the full-size
// image is rendered once and the other texts are checked at 256 px.
describe("qrPng", () => {
  it.each(URLS)("a reader decodes %s back to exactly that text", async (url) => {
    const decoded = decodePng(await qrPng(url, 256));
    expect(decoded.text).toBe(url);
  }, 30000);

  it("is 1024 x 1024, black on white, with a quiet zone of white all round, and decodes", async () => {
    const buffer = await qrPng(URLS[0]!);
    const { width, height, png, text } = decodePng(buffer);
    expect([width, height]).toEqual([QR_PNG_SIZE, QR_PNG_SIZE]);
    expect(text).toBe(URLS[0]);

    const at = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return [png.data[i], png.data[i + 1], png.data[i + 2]];
    };
    // Every pixel on the four edges is white (the quiet zone is 4 modules, far wider than this).
    for (let i = 0; i < width; i += 7) {
      for (const [x, y] of [[i, 0], [i, height - 1], [0, i], [width - 1, i]] as const) {
        expect(at(x, y)).toEqual([255, 255, 255]);
      }
    }
    // And the symbol itself uses pure black.
    let black = 0;
    for (let y = 0; y < height; y += 9) for (let x = 0; x < width; x += 9) if (at(x, y)[0] === 0) black += 1;
    expect(black).toBeGreaterThan(200);
  }, 60000);
});

describe("qrSvg", () => {
  it("is an SVG with a white ground and black modules", async () => {
    const svg = await qrSvg(URLS[0]!);
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain("#000000");
    expect(svg).toContain("#ffffff");
  });
});

describe("the text a stadium's QR encodes", () => {
  const saved = { domain: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
  afterEach(() => {
    process.env.APP_BASE_DOMAIN = saved.domain;
    if (saved.protocol === undefined) delete process.env.APP_PROTOCOL;
    else process.env.APP_PROTOCOL = saved.protocol;
  });

  it("is the canonical public URL of the slug", () => {
    process.env.APP_BASE_DOMAIN = "lebstads.com";
    process.env.APP_PROTOCOL = "https";
    expect(publicPageUrl("al-nour")).toBe("https://al-nour.lebstads.com/");
    process.env.APP_BASE_DOMAIN = "localhost:3000";
    process.env.APP_PROTOCOL = "http";
    expect(publicPageUrl("sami")).toBe("http://sami.localhost:3000/");
  });

  it("is empty when the domain is not configured, so the route refuses instead of encoding a wrong link", () => {
    process.env.APP_BASE_DOMAIN = "";
    expect(publicPageUrl("al-nour")).toBe("");
  });
});
