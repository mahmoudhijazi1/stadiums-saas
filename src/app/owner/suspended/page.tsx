import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnavailableNotice } from "@/components/unavailable-notice";
import { getUiLocale } from "@/lib/get-ui-locale";
import { getCurrentTenant } from "@/lib/tenant-context";

/**
 * Where owners land while the platform has suspended their stadium (decision 7).
 * Outside the (app) shell like /owner/login. Never redirects to login; an
 * active tenant goes to /owner/today (which itself only sends to login), so
 * the two can never bounce.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SuspendedPage() {
  const tenant = await getCurrentTenant();
  if (!tenant.suspended) redirect("/owner/today");
  return <UnavailableNotice kind="owner" locale={await getUiLocale()} />;
}
