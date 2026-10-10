import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { currentBrandIdentity } from "@/app/brand/current-brand";
import { planBrandIcon } from "@/lib/brand-icon-plan";

/**
 * The generated logo: one symbol on a preset colour. GET /brand/icon/{32|180|192|512|512-maskable}.
 * The tenant is the Host's, resolved in currentBrandIdentity; the ONLY inputs to the picture are
 * the symbol (first letter or digit of the name, else a fixed symbol) and the preset key mapped to
 * fixed colours (see planBrandIcon). Never the full name, never a query value except the cache
 * version. An unknown or suspended stadium gets the neutral lebstads icon. Fonts are the
 * self-hosted IBM Plex Sans Arabic faces converted to TTF (ImageResponse does not read WOFF2).
 */
const FONT_DIR = join(process.cwd(), "src", "fonts", "brand");
let fonts: Promise<[Buffer, Buffer]> | null = null;

/** Read once, on first use (the files are small and do not depend on the request). */
function loadFonts(): Promise<[Buffer, Buffer]> {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "brand-latin-600.ttf")),
    readFile(join(FONT_DIR, "brand-arabic-600.ttf")),
  ]);
  return fonts;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
): Promise<Response> {
  const { size } = await context.params;
  const plan = planBrandIcon(size, await currentBrandIdentity(), new URL(request.url).searchParams.get("v"));
  if (!plan) return new Response(null, { status: 404 });
  const [latin, arabic] = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: plan.background,
          color: plan.text,
          borderRadius: plan.borderRadius,
          fontFamily: "BrandLatin, Brand",
          fontWeight: 600,
          fontSize: plan.fontSize,
          lineHeight: 1,
        }}
      >
        {plan.symbol}
      </div>
    ),
    {
      width: plan.px,
      height: plan.px,
      fonts: [
        { name: "BrandLatin", data: latin, weight: 600, style: "normal" },
        { name: "Brand", data: arabic, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": plan.cacheControl },
    },
  );
}
