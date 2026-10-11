import type { Metadata } from "next";
import { UnavailableNotice } from "@/components/shell/unavailable-notice";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";
import { publicPageMetadata } from "@/app/(public)/_components/public-metadata";
import { publicPageUrl } from "@/modules/stadium/domain/public-page-url";

/**
 * Gate for every public path of a suspended tenant (decision 7): the neutral
 * page, robots noindex, no tenant data. Pages are dynamic, so Next already
 * sends Cache-Control: no-store. A real 503 is deferred (see docs/ROADMAP.md).
 *
 * The metadata is the stadium's own (title, description, share card, canonical), built by
 * publicPageMetadata. An unknown host throws notFound() in getCurrentTenant; the metadata then
 * stays neutral and noindex, and the body below answers the 404.
 */
export async function generateMetadata(): Promise<Metadata> {
  let tenant = null;
  try {
    tenant = await getCurrentTenant();
  } catch {
    tenant = null;
  }
  return publicPageMetadata({
    tenant,
    locale: await getUiLocale(),
    canonicalUrl: tenant ? publicPageUrl(tenant.slug) : "",
  });
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (tenant.suspended) {
    return <UnavailableNotice kind="public" locale={await getUiLocale()} />;
  }
  return children;
}
