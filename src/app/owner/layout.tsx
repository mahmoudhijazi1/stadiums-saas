import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerHeader } from "@/app/owner/header";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { Container } from "@/components/ui/container";
import { FlashToast } from "@/components/ui/flash-toast";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";

/**
 * Shared owner chrome. layout.md: nested layout persists across tab Link
 * (does not remount). No searchParams here — they would go stale.
 * Auth gate lives here so every tab is locked. FlashToast is a Client
 * child (useSearchParams). No owner loading.tsx (would wrap page.js).
 * Tab bar is first in the row so at lg it sits on the inline-start edge.
 */
export default async function OwnerLayout({
  children,
}: LayoutProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const membership = await requireOwnerMembership();
  const showBook = can(membership, BOOKINGS_CREATE);
  const locale = await getUiLocale();

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row lg:items-start">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <OwnerTabBar showBook={showBook} locale={locale} />
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(88px+env(safe-area-inset-bottom))] lg:min-h-dvh lg:pb-0">
        <OwnerHeader
          tenantName={tenant.name}
          roleLabel={ui(`role.${membership.role}`, locale)}
          identifier={membership.identifier}
          logoutLabel={ui("owner.logout", locale)}
          locale={locale}
        />
        <Container className="flex flex-1 flex-col gap-8 py-6">{children}</Container>
      </main>
    </div>
  );
}
