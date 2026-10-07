"use client";

import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";

type DayNav = {
  /** The selected day, optimistic: already the new day while the server renders it. */
  selected: string;
  /** A day change is loading. */
  pending: boolean;
  go: (date: string, href: string) => void;
};

const DayNavContext = createContext<DayNav | null>(null);

/**
 * Owns the day change on Today: the tab updates at once (useOptimistic) and the old day
 * stays on screen, dimmed, until the new one has rendered (a transition keeps the revealed
 * Suspense content instead of showing the skeleton).
 */
export function DayNavProvider({
  selected,
  children,
}: {
  selected: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(selected);
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (date: string, href: string) => {
      startTransition(() => {
        setOptimistic(date);
        router.push(href);
      });
    },
    [router, setOptimistic],
  );

  return (
    <DayNavContext value={{ selected: optimistic, pending, go }}>{children}</DayNavContext>
  );
}

export function useDayNav(): DayNav {
  const value = use(DayNavContext);
  if (!value) throw new Error("useDayNav needs DayNavProvider");
  return value;
}

// The last day shown. Module-level so it survives a remount; null on first load and after
// leaving Today, so only a change of the selected date can animate.
let lastDate: string | null = null;

/**
 * The day's content. Slides in from the side of the new day (toward the future enters from
 * the future side, mirrored in RTL), transform and opacity only, 200ms. A router.refresh()
 * or a booking on the same day keeps the date, so nothing plays.
 */
export function DayContent({ date, children }: { date: string; children: ReactNode }) {
  const { pending } = useDayNav();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const previous = lastDate;
    lastDate = date;
    const element = ref.current;
    if (!element || previous === null || previous === date) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rtl = getComputedStyle(element).direction === "rtl";
    // Future sits on the right in LTR and on the left in RTL.
    const from = (date > previous ? 1 : -1) * (rtl ? -1 : 1) * 16;
    element.animate(
      [
        { transform: `translateX(${from}px)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }, [date]);

  useLayoutEffect(
    () => () => {
      lastDate = null;
    },
    [],
  );

  return (
    <div
      ref={ref}
      aria-busy={pending}
      className={cn(
        "flex flex-col gap-4 transition-opacity duration-150 motion-reduce:transition-none",
        pending && "opacity-60",
      )}
    >
      {children}
    </div>
  );
}
