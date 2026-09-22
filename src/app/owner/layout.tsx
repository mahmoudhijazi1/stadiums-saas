import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerHeader } from "@/app/owner/header";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { FlashToast } from "@/components/ui/flash-toast";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * Shared owner chrome. layout.md: nested layout persists across tab Link
 * (does not remount). No searchParams here — they would go stale.
 * Auth gate lives here so every tab is locked. FlashToast is a Client
 * child (useSearchParams). No owner loading.tsx (would wrap page.js).
 */
export default async function OwnerLayout({
  children,
}: LayoutProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const membership = await requireOwnerMembership();
  const showBook = can(membership, BOOKINGS_CREATE);
  const locale = await getUiLocale();

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <OwnerHeader
        tenantName={tenant.name}
        roleLabel={ui(`role.${membership.role}`, locale)}
        identifier={membership.identifier}
        logoutLabel={ui("owner.logout", locale)}
        locale={locale}
      />
      <div className="flex flex-1 flex-col gap-8 px-6 py-6 pb-4">{children}</div>
      <OwnerTabBar showBook={showBook} locale={locale} />
    </div>
  );
}
