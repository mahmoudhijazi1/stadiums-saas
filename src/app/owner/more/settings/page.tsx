import { Suspense } from "react";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerSettings } from "./panel";
import { SettingsSkeleton } from "./skeleton";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * Settings. Rate set form lives here (was Money). No loading.tsx.
 * Local Next page.md: searchParams is a Promise.
 */
export default async function OwnerSettingsPage() {
  const membership = await requireOwnerMembership();
  const locale = await getUiLocale();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-3xl lg:text-4xl">{ui("owner.settings", locale)}</h2>
      <Suspense fallback={<SettingsSkeleton />}>
        <OwnerSettings membership={membership} locale={locale} />
      </Suspense>
    </section>
  );
}
