import Link from "next/link";
import { BusinessMenu } from "@/app/owner/business-menu";
import { OfflinePill } from "@/app/owner/offline-pill";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { Search } from "lucide-react";

/**
 * Below lg: a floating inverse bar, inset like the bottom nav.
 * At lg: a full-width dark block on the content column.
 * Sticky. It does not hide on scroll.
 * Search opens /owner/search.
 */
export function OwnerHeader({
  tenantName,
  locale,
}: {
  tenantName: string;
  locale: UiLocale;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-bg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2",
        "lg:bg-inverse lg:px-0 lg:pt-0 lg:pb-0 lg:text-inverse-ink",
        "dark:lg:border-b dark:lg:border-line dark:lg:bg-surface dark:lg:text-ink",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3",
          "rounded-[var(--radius-sheet)] border border-line bg-inverse px-3 py-2 text-inverse-ink",
          "lg:mx-auto lg:max-w-5xl lg:rounded-none lg:border-0 lg:bg-transparent lg:px-8 lg:py-3 lg:pt-[max(0.75rem,env(safe-area-inset-top))]",
          "xl:max-w-6xl",
        )}
      >
        <BusinessMenu tenantName={tenantName} locale={locale} />
        <Link
          href="/owner/search"
          aria-label={ui("owner.search", locale)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-inverse-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:lg:text-ink"
        >
          <Search aria-hidden className="size-5" />
        </Link>
      </div>
      <OfflinePill locale={locale} />
    </header>
  );
}
