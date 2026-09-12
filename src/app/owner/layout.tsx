import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { submitLogout } from "@/app/login/actions";
import { FlashToast } from "@/components/ui/flash-toast";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
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
  const membership = await requireOwnerMembership(tenant.slug);
  const showBook = can(membership, BOOKINGS_CREATE);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      <header className="flex items-start justify-between gap-4 px-6 pt-8">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            <LtrIsolate>{membership.identifier}</LtrIsolate>
            {" · "}
            {ui(`role.${membership.role}`)}
          </p>
        </div>
        <form action={submitLogout}>
          <input type="hidden" name="tenant" value={tenant.slug} />
          <SubmitButton variant="outline">{ui("owner.logout")}</SubmitButton>
        </form>
      </header>
      <div className="flex flex-1 flex-col gap-8 px-6 py-8 pb-4">{children}</div>
      <OwnerTabBar tenantSlug={tenant.slug} showBook={showBook} />
    </div>
  );
}
