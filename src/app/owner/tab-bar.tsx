"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useLiveQueue } from "@/app/owner/live-queue";
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
  const live = useLiveQueue();
  // INTENTIONALLY HIDDEN: the "+" (Record) action in the tab bar is switched off for now.
  // Set HIDE_RECORD to false to bring it back; the button and its sheet below are unchanged.
  const HIDE_RECORD = true;
  const showRecord = HIDE_RECORD ? false : showBooking || showExpense;
  const badgeCount = live?.pendingCount ?? pendingCount;
  const [recordOpen, setRecordOpen] = useState(false);
  // The tab tapped before the page has loaded, so the pill moves at once. It only counts while
  // the pathname is still the one it was tapped on; a finished navigation takes over by itself
  // (pathname changes), and a failed or cancelled one gives up after a few seconds.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());

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
      badge: badgeCount,
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

  const activeHref =
    tapped && tapped.from === pathname
      ? tapped.href
      : links.find((tab) => tabSelected(pathname, tab.href))?.href;

  // One pill slides to the active tab. Measured in pixels (offsetLeft/offsetWidth), so it is
  // right in RTL without separate logic. Hidden until the first measurement, and the
  // transition is only switched on after it, so it never animates in from the corner.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const pill = pillRef.current;
    if (!track || !pill) return;
    const place = () => {
      const tab = activeHref ? tabRefs.current.get(activeHref) : undefined;
      if (!tab || tab.offsetWidth === 0) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.width = `${tab.offsetWidth - 8}px`;
      pill.style.transform = `translate(${tab.offsetLeft + 4}px, ${tab.offsetTop + (tab.offsetHeight - 48) / 2}px)`;
      pill.style.opacity = "1";
    };
    place();
    if (!pill.dataset.ready) requestAnimationFrame(() => (pill.dataset.ready = "1"));
    const observer = new ResizeObserver(place);
    observer.observe(track);
    return () => observer.disconnect();
  }, [activeHref]);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  return (
    <nav
      aria-label={ui("owner.tabs", locale)}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:sticky lg:inset-x-auto lg:start-0 lg:top-0 lg:bottom-auto lg:z-20 lg:h-dvh lg:w-60 lg:shrink-0",
        "lg:border-e lg:border-line lg:bg-surface lg:px-3 lg:py-4 lg:pb-4",
      )}
    >
      {/* Fade: page colour from the bar's edge up, so scrolled content never shows through or
          collides with the floating bar. Phones only; the lg sidebar is not over content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 bottom-0 bg-gradient-to-t from-bg from-60% to-transparent lg:hidden"
      />
      <div
        ref={trackRef}
        className={cn(
          "relative flex gap-1 rounded-[var(--radius-sheet)] border border-line bg-surface p-1 text-ink shadow-sm",
          "lg:h-full lg:flex-col lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        )}
      >
        {/* The active-tab pill (phones only). Physical left/top on purpose: it is placed with
            measured pixels, which are physical in both directions. */}
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 h-12 rounded-full bg-surface-2 opacity-0 data-[ready]:transition-[transform,width] data-[ready]:duration-[220ms] data-[ready]:ease-out motion-reduce:transition-none lg:hidden"
        />
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
          const selected = tab.href === activeHref;
          const Icon = tab.Icon;
          const label = ui(tab.labelKey, locale);
          const count = tab.badge ?? 0;
          return (
            <div
              key={tab.href}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.href, node);
                else tabRefs.current.delete(tab.href);
              }}
              className={cn("relative min-w-0 flex-1 lg:flex-none", tab.order)}
            >
              <Link
                href={tab.href}
                aria-current={tabSelected(pathname, tab.href) ? "page" : undefined}
                aria-label={label}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0) return;
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  setTapped({ href: tab.href, from: pathname });
                  if (tapTimer.current) clearTimeout(tapTimer.current);
                  tapTimer.current = setTimeout(() => setTapped(null), 4000);
                }}
                className={cn(
                  "flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 outline-none",
                  "transition-colors duration-150 ease-out motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
                  "lg:h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3",
                  selected
                    ? "text-action-ink"
                    : "text-muted-foreground hover:text-ink lg:text-inherit lg:opacity-70 lg:hover:opacity-100",
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
                        "bg-accent-brand text-accent-ink",
                      )}
                    >
                      {count > 9 ? "9+" : String(count)}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full overflow-x-clip text-xs leading-[1.2] font-medium text-ellipsis whitespace-nowrap">
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
