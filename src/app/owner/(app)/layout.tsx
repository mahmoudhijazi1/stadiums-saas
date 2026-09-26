import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import {
  BOOKINGS_CREATE,
  EXPENSES_RECORD,
  can,
} from "@/modules/access/domain/can";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { actionablePending } from "@/modules/booking/domain/expired-request";
import { OwnerHeader } from "@/app/owner/header";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { Container } from "@/components/ui/container";
import { FlashToast } from "@/components/ui/flash-toast";
import { getUiLocale } from "@/lib/get-ui-locale";

/**
 * Shell for routes inside (app). Local route-groups.md: the parenthesized
 * folder is omitted from the URL, and only those routes share this layout.
 * Login stays at src/app/owner/login and does not get this shell.
 * Auth is per page via requireOwnerMembership. This layout does not redirect.
 * layout.md: a nested layout persists across tab Link and cannot pass data
 * to children. No searchParams here — they would go stale. No owner
 * loading.tsx (would wrap page.js). Tab bar is first so at lg it sits on
 * the inline-start edge.
 */
export default async function OwnerLayout({
  children,
}: LayoutProps<"/owner">) {
  const tenant = await getCurrentTenant();
  const membership = await getCurrentMembership();
  const showBooking = membership ? can(membership, BOOKINGS_CREATE) : false;
  const showExpense = membership ? can(membership, EXPENSES_RECORD) : false;
  const pending = membership ? await listPendingRequests() : [];
  const locale = await getUiLocale();

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row lg:items-start">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <OwnerTabBar
        locale={locale}
        pendingCount={actionablePending(pending, new Date()).length}
        showBooking={showBooking}
        showExpense={showExpense}
      />
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(88px+env(safe-area-inset-bottom))] lg:min-h-dvh lg:pb-0">
        <OwnerHeader tenantName={tenant.name} locale={locale} />
        <Container className="flex flex-1 flex-col gap-8 py-6">{children}</Container>
      </main>
    </div>
  );
}
