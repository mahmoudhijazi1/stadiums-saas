"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChartColumn,
  Ellipsis,
  House,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { ui } from "@/lib/ui-copy";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";

type NavLink = {
  kind: "link";
  href: string;
  labelKey: string;
  Icon: LucideIcon;
  order: string;
  badge?: number;
};

function tabSelected(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const rowClass =
  "flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-start text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * One nav, two layouts. Below lg: floating bottom bar, ＋ in the center.
 * At lg: 240px sticky rail on the inline-start edge. ＋ is a primary
 * button at the top of the rail, then the four destinations.
 */
export function OwnerTabBar({
  locale = "ar",
  pendingCount,
  showBooking,
  showExpense,
}: {
  locale?: UiLocale;
  pendingCount: number;
  showBooking: boolean;
  showExpense: boolean;
}) {
  const pathname = usePathname();
  const showRecord = showBooking || showExpense;
  const [recordOpen, setRecordOpen] = useState(false);

  const links: NavLink[] = [
    {
      kind: "link",
      href: "/owner/today",
      labelKey: "owner.today",
      Icon: House,
      order: "order-1 lg:order-2",
    },
    {
      kind: "link",
      href: "/owner/requests",
      labelKey: "owner.requestsTab",
      Icon: Bell,
      order: "order-2 lg:order-3",
      badge: pendingCount,
    },
    {
      kind: "link",
      href: "/owner/money",
      labelKey: "owner.money",
      Icon: ChartColumn,
      order: "order-4",
    },
    {
      kind: "link",
      href: "/owner/more",
      labelKey: "owner.more",
      Icon: Ellipsis,
      order: "order-5",
    },
  ];

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
      <div
        className={cn(
          "flex gap-1 rounded-[var(--radius-sheet)] border border-line bg-inverse p-1 text-inverse-ink",
          "lg:h-full lg:flex-col lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 dark:lg:text-ink",
        )}
      >
        {showRecord ? (
          <div className="order-3 min-w-0 flex-1 lg:order-1 lg:flex-none">
            <button
              type="button"
              aria-label={ui("owner.record", locale)}
              onClick={() => setRecordOpen(true)}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] bg-accent-brand text-accent-ink outline-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
                "lg:h-12 lg:flex-row lg:justify-center lg:gap-2",
              )}
            >
              <Plus aria-hidden className="size-5 shrink-0" strokeWidth={2.25} />
              <span className="max-w-full truncate text-xs leading-none font-medium lg:text-sm">
                {ui("owner.record", locale)}
              </span>
            </button>
          </div>
        ) : null}

        {links.map((tab) => {
          const selected = tabSelected(pathname, tab.href);
          const Icon = tab.Icon;
          const label = ui(tab.labelKey, locale);
          const count = tab.badge ?? 0;
          return (
            <div key={tab.href} className={cn("min-w-0 flex-1 lg:flex-none", tab.order)}>
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
                <span className="relative">
                  <Icon
                    aria-hidden
                    className="size-5 shrink-0"
                    strokeWidth={selected ? 2.25 : 1.75}
                  />
                  {count > 0 ? (
                    <span
                      className={cn(
                        "absolute -top-1.5 inset-e-[-0.65rem] min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-medium tabular-nums",
                        selected
                          ? "bg-accent-ink text-accent-brand"
                          : "bg-accent-brand text-accent-ink",
                      )}
                    >
                      {count > 9 ? "9+" : String(count)}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate text-xs leading-none font-medium">
                  {label}
                </span>
              </Link>
            </div>
          );
        })}
      </div>

      <BottomSheet open={recordOpen} onOpenChange={setRecordOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.record", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-1">
            {showBooking ? (
              <Link
                href="/owner/book"
                className={rowClass}
                onClick={() => setRecordOpen(false)}
              >
                {ui("owner.recordBooking", locale)}
              </Link>
            ) : null}
            {showExpense ? (
              <Link
                href="/owner/money"
                className={rowClass}
                onClick={() => setRecordOpen(false)}
              >
                {ui("owner.expenseAction", locale)}
              </Link>
            ) : null}
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </nav>
  );
}
