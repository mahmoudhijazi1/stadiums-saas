"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarPlus,
  ChartColumn,
  Ellipsis,
  House,
  type LucideIcon,
} from "lucide-react";
import { ui } from "@/lib/ui-copy";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";

const TAB_META: {
  href: string;
  labelKey: string;
  Icon: LucideIcon;
  bookOnly?: boolean;
}[] = [
  { href: "/owner/today", labelKey: "owner.home", Icon: House },
  { href: "/owner/book", labelKey: "owner.book", Icon: CalendarPlus, bookOnly: true },
  { href: "/owner/waitlist", labelKey: "owner.waitlistTab", Icon: Bell },
  { href: "/owner/money", labelKey: "owner.reports", Icon: ChartColumn },
  { href: "/owner/more", labelKey: "owner.more", Icon: Ellipsis },
];

function tabSelected(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Active tab from usePathname (layout.md: layouts cannot read pathname).
 * Links are real routes; tenant query is local-dev only.
 * Nested More routes (`/owner/more/settings`) keep More selected.
 */
export function OwnerTabBar({
  tenantSlug,
  showBook,
  locale = "ar",
}: {
  tenantSlug: string;
  showBook: boolean;
  locale?: UiLocale;
}) {
  const pathname = usePathname();
  const tabs = TAB_META.filter((tab) => !tab.bookOnly || showBook);

  return (
    <nav
      aria-label={ui("owner.tabs", locale)}
      className="sticky bottom-0 z-10 mt-auto px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="flex gap-1 rounded-2xl border bg-card/95 p-1 shadow-lg backdrop-blur-md">
        {tabs.map((tab) => {
          const selected = tabSelected(pathname, tab.href);
          const Icon = tab.Icon;
          const label = ui(tab.labelKey, locale);
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={{
                  pathname: tab.href,
                  query: { tenant: tenantSlug },
                }}
                aria-current={selected ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 outline-none",
                  "text-muted-foreground transition-colors duration-200",
                  "hover:text-foreground",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected && "bg-primary/10 text-primary",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "size-5 transition-transform duration-200",
                    selected && "scale-110",
                  )}
                  strokeWidth={selected ? 2.25 : 1.75}
                />
                <span className="max-w-full truncate text-[11px] leading-none font-medium">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
