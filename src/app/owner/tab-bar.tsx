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
 * One nav, two layouts. Below lg it is a floating bottom bar.
 * At lg it is a 240px sticky rail on the inline-start edge
 * (right in Arabic) via flex order + border-inline-end — no dir branch.
 * Active item is an accent fill with accent-ink.
 */
export function OwnerTabBar({
  showBook,
  locale = "ar",
}: {
  showBook: boolean;
  locale?: UiLocale;
}) {
  const pathname = usePathname();
  const tabs = TAB_META.filter((tab) => !tab.bookOnly || showBook);

  return (
    <nav
      aria-label={ui("owner.tabs", locale)}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:sticky lg:inset-x-auto lg:start-0 lg:top-0 lg:bottom-auto lg:z-20 lg:h-dvh lg:w-60 lg:shrink-0",
        "lg:border-e lg:border-line lg:bg-inverse lg:px-3 lg:py-4 lg:pb-4",
        "dark:lg:border-line dark:lg:bg-surface",
      )}
    >
      <ul className="flex gap-1 rounded-[var(--radius-sheet)] border border-line bg-inverse p-1 text-inverse-ink lg:h-full lg:flex-col lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 dark:lg:text-ink">
        {tabs.map((tab) => {
          const selected = tabSelected(pathname, tab.href);
          const Icon = tab.Icon;
          const label = ui(tab.labelKey, locale);
          return (
            <li key={tab.href} className="min-w-0 flex-1 lg:flex-none">
              <Link
                href={tab.href}
                aria-current={selected ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-1 outline-none",
                  "transition-colors duration-150 ease-out motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
                  "lg:h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3",
                  selected
                    ? "bg-accent-brand text-accent-ink"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <Icon aria-hidden className="size-5 shrink-0" strokeWidth={selected ? 2.25 : 1.75} />
                <span className="max-w-full truncate text-xs leading-none font-medium">
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
