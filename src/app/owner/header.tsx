import Link from "next/link";
import { BusinessMenu } from "@/app/owner/business-menu";
import { OfflinePill } from "@/app/owner/offline-pill";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { Search, ShoppingBag } from "lucide-react";

/**
 * Below lg: a floating surface bar, inset like the bottom nav.
 * At lg: a full-width dark block on the content column.
 * Sticky. It does not hide on scroll.
 * Search opens /owner/search; the shop button (members who may sell) opens the counter.
 */
export function OwnerHeader({
  tenantName,
  publicUrl,
  locale,
  showSell,
  logoSrc,
}: {
  tenantName: string;
  publicUrl: string;
  locale: UiLocale;
  /** The stadium's generated logo URL (versioned). */
  logoSrc: string;
  /** shop.sell: the sell button beside search. */
  showSell: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-bg px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2",
        "lg:border-b lg:border-line lg:bg-surface lg:px-0 lg:pt-0 lg:pb-0 lg:text-ink",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3",
          "rounded-[var(--radius-sheet)] border border-line bg-surface px-3 py-2 text-ink shadow-sm",
          "lg:mx-auto lg:max-w-5xl lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:px-8 lg:py-3 lg:pt-[max(0.75rem,env(safe-area-inset-top))]",
          "xl:max-w-6xl",
        )}
      >
        <BusinessMenu tenantName={tenantName} publicUrl={publicUrl} locale={locale} logoSrc={logoSrc} />
        <div className="flex shrink-0 items-center">
          {showSell ? (
            <Link
              href="/owner/sell"
              aria-label={ui("owner.sell", locale)}
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ShoppingBag aria-hidden className="size-5" />
            </Link>
          ) : null}
          <Link
            href="/owner/search"
            aria-label={ui("owner.search", locale)}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Search aria-hidden className="size-5" />
          </Link>
        </div>
      </div>
      <OfflinePill locale={locale} />
    </header>
  );
}
