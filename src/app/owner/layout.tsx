import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import {
  BOOKINGS_CREATE,
  EXPENSES_RECORD,
  SETTINGS_MANAGE,
  can,
} from "@/modules/access/domain/can";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerHeader } from "@/app/owner/header";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { Container } from "@/components/ui/container";
import { FlashToast } from "@/components/ui/flash-toast";
import { getUiLocale } from "@/lib/get-ui-locale";

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
  const showBooking = can(membership, BOOKINGS_CREATE);
  const showExpense = can(membership, EXPENSES_RECORD);
  const showSettings = can(membership, SETTINGS_MANAGE);
  const pending = await listPendingRequests();
  const locale = await getUiLocale();

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row lg:items-start">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <OwnerTabBar
        locale={locale}
        pendingCount={pending.length}
        showBooking={showBooking}
        showExpense={showExpense}
      />
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(88px+env(safe-area-inset-bottom))] lg:min-h-dvh lg:pb-0">
        <OwnerHeader
          tenantName={tenant.name}
          locale={locale}
          showSettings={showSettings}
        />
        <Container className="flex flex-1 flex-col gap-8 py-6">{children}</Container>
      </main>
    </div>
  );
}
