import type { Metadata } from "next";
import { UnavailableNotice } from "@/components/unavailable-notice";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";

/**
 * Gate for every public path of a suspended tenant (decision 7): the neutral
 * page, robots noindex, no tenant data. Pages are dynamic, so Next already
 * sends Cache-Control: no-store. A real 503 is deferred (see docs/ROADMAP.md).
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  return tenant.suspended ? { robots: { index: false, follow: false } } : {};
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (tenant.suspended) {
    return <UnavailableNotice kind="public" locale={await getUiLocale()} />;
  }
  return children;
}
