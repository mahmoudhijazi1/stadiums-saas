import type { Metadata } from "next";
import { brandIconPath, brandIdentityOf } from "@/modules/stadium/domain/brand-identity";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import type { CurrentTenant } from "@/lib/tenant-context";

const NOINDEX: Metadata = { robots: { index: false, follow: false } };

/** The Arabic call to action after the stadium name, as written in every language. */
const TITLE_SUFFIX = "احجز ملعبك";

/**
 * The metadata of a stadium's public page. The title is "<name> · احجز ملعبك" (the name is the
 * owner's text, never translated). The description is the address. Open Graph and Twitter use the
 * stadium's generated logo (/brand/icon/512). The page is indexable.
 *
 * A suspended stadium and an unknown host (tenant null) get noindex and nothing else: no name, no
 * address, no logo. The page language and direction (lang, dir) are set on <html> by the root layout
 * from the same locale. `canonicalUrl` is the page's absolute URL ("" when APP_BASE_DOMAIN is unset), and
 * with it the card images are absolute too.
 */
export function publicPageMetadata({
  tenant,
  locale,
  canonicalUrl,
}: {
  tenant: Pick<CurrentTenant, "name" | "address" | "brandPreset" | "suspended"> | null;
  locale: UiLocale;
  canonicalUrl: string;
}): Metadata {
  if (!tenant || tenant.suspended) return NOINDEX;

  const title = `${tenant.name} · ${TITLE_SUFFIX}`;
  const description = tenant.address || ui("public.metaFallback", locale).replace("{name}", tenant.name);
  const iconPath = brandIconPath("512", brandIdentityOf(tenant));
  const image = canonicalUrl ? new URL(iconPath, canonicalUrl).toString() : iconPath;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: tenant.name,
      url: canonicalUrl || undefined,
      locale: locale === "ar" ? "ar_LB" : "en_US",
      images: [{ url: image, width: 512, height: 512 }],
    },
    twitter: { card: "summary", title, description, images: [image] },
  };
}
