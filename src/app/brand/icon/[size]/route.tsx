import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import {
  brandVersion,
  FIXED_SYMBOL,
  isBrandIconSize,
  type BrandIconSize,
} from "@/lib/brand-identity";
import { brandColors, NEUTRAL_BRAND } from "@/lib/brand-presets";

/**
 * The generated logo: one symbol on a preset colour. GET /brand/icon/{32|180|192|512|512-maskable}.
 * The tenant is the Host's, resolved in currentBrandIdentity; the ONLY inputs to the picture are
 * the symbol (first letter or digit of the name, else a fixed symbol) and the preset key mapped to
 * fixed colours. Never the full name, never a query value. An unknown or suspended stadium gets
 * the neutral lebstads icon. Fonts are the self-hosted IBM Plex Sans Arabic faces (converted to
 * TTF, which ImageResponse needs).
 */
const SPECS: Record<BrandIconSize, { px: number; radius: number; scale: number }> = {
  "32": { px: 32, radius: 0.2, scale: 0.62 },
  "180": { px: 180, radius: 0, scale: 0.56 }, // apple-touch: full square, the OS rounds it
  "192": { px: 192, radius: 0.22, scale: 0.56 },
  "512": { px: 512, radius: 0.22, scale: 0.56 },
  // Maskable: full bleed, and the symbol sits well inside the central 80% safe zone.
  "512-maskable": { px: 512, radius: 0, scale: 0.36 },
};

const FONT_DIR = join(process.cwd(), "src", "fonts", "brand");
const latinFont = await readFile(join(FONT_DIR, "brand-latin-600.ttf"));
const arabicFont = await readFile(join(FONT_DIR, "brand-arabic-600.ttf"));

/** A year for the versioned URL, a few minutes for any other. A stale ?v= never gets "immutable". */
const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=300, must-revalidate";

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
): Promise<Response> {
  const { size } = await context.params;
  if (!isBrandIconSize(size)) return new Response(null, { status: 404 });
  const spec = SPECS[size];

  const identity = await currentBrandIdentity();
  const symbol = identity ? identity.symbol : "L";
  const colours = identity ? brandColors(identity.preset) : NEUTRAL_BRAND;

  const requested = new URL(request.url).searchParams.get("v");
  const cacheControl = requested !== null && requested === brandVersion(identity) ? IMMUTABLE : SHORT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colours.background,
          color: colours.text,
          borderRadius: Math.round(spec.px * spec.radius),
          fontFamily: "BrandLatin, Brand",
          fontWeight: 600,
          fontSize: Math.round(spec.px * spec.scale),
          lineHeight: 1,
        }}
      >
        {symbol === "" ? FIXED_SYMBOL : symbol}
      </div>
    ),
    {
      width: spec.px,
      height: spec.px,
      fonts: [
        { name: "BrandLatin", data: latinFont, weight: 600, style: "normal" },
        { name: "Brand", data: arabicFont, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": cacheControl },
    },
  );
}
