import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { publicPageUrl } from "@/lib/public-page-url";
import { qrPng, qrSvg } from "@/lib/qr";
import { getCurrentTenant } from "@/lib/tenant-context";

/**
 * The QR code of this stadium's public page, as an image.
 *
 * GET /owner/qr?format=svg|png (svg by default). Any logged-in membership may fetch it.
 * Local route.md: a GET returns a Web Response. The tenant comes from the host only and the
 * text encoded is `publicPageUrl(slug)`, the same canonical URL the Copy and WhatsApp
 * buttons use; no query parameter can change it. Not cached (like the other owner
 * responses). A suspended tenant gets the same 403 as the live queue.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const tenant = await getCurrentTenant();
  if (tenant.suspended) {
    return Response.json({ error: "tenant_suspended" }, { status: 403, headers: NO_STORE });
  }
  if (!(await getCurrentMembership())) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const url = publicPageUrl(tenant.slug);
  if (!url) {
    // APP_BASE_DOMAIN is not set: there is no honest URL to encode.
    return Response.json({ error: "public_url_not_configured" }, { status: 503, headers: NO_STORE });
  }

  const format = new URL(request.url).searchParams.get("format") === "png" ? "png" : "svg";
  if (format === "png") {
    const png = await qrPng(url);
    return new Response(new Uint8Array(png), {
      headers: {
        ...NO_STORE,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${tenant.slug}-qr.png"`,
      },
    });
  }
  return new Response(await qrSvg(url), {
    headers: { ...NO_STORE, "Content-Type": "image/svg+xml" },
  });
}
