import { Suspense } from "react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { BOOKINGS_CREATE, can } from "@/modules/access/domain/can";
import { requireOwnerMembership } from "@/app/owner/shared";
import { OwnerTabBar } from "@/app/owner/tab-bar";
import { submitLogout } from "@/app/login/actions";
import { FlashToast } from "@/components/ui/flash-toast";
import { LangToggle } from "@/components/lang-toggle";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import { getUiLocale } from "@/lib/get-ui-locale";
import { ui } from "@/lib/ui-copy";
import { LogOut } from "lucide-react";

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
  const locale = await getUiLocale();

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <Suspense fallback={null}>
        <FlashToast locale={locale} />
      </Suspense>
      <header className="flex items-center justify-between gap-3 px-6 pt-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {tenant.name}
            {" · "}
            {ui(`role.${membership.role}`, locale)}
          </p>
          <p className="text-xs text-muted-foreground">
            <LtrIsolate>{membership.identifier}</LtrIsolate>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LangToggle locale={locale} />
          <form action={submitLogout}>
            <input type="hidden" name="tenant" value={tenant.slug} />
            <SubmitButton
              variant="ghost"
              size="icon-sm"
              aria-label={ui("owner.logout", locale)}
            >
              <LogOut />
            </SubmitButton>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-8 px-6 py-6 pb-4">{children}</div>
      <OwnerTabBar
        tenantSlug={tenant.slug}
        showBook={showBook}
        locale={locale}
      />
    </div>
  );
}
