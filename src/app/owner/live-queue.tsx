"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CountedPhrase } from "@/app/owner/notify-list";
import {
  liveQueueChanged,
  nextPollDelayMs,
  type LiveQueueSnapshot,
} from "@/modules/booking/domain/live-queue";
import type { UiLocale } from "@/lib/locale";
import { uiCount } from "@/lib/ui-copy";

const LiveQueueContext = createContext<LiveQueueSnapshot | null>(null);

export function useLiveQueue(): LiveQueueSnapshot | null {
  return useContext(LiveQueueContext);
}

/** Today banner count. Follows the poll, then the server render after refresh. */
export function LiveRequestCount({
  fallback,
  locale,
}: {
  fallback: number;
  locale: UiLocale;
}) {
  const live = useLiveQueue();
  const count = live?.pendingCount ?? fallback;
  return <CountedPhrase text={uiCount("owner.requests", count, locale)} />;
}

/**
 * Poll /owner/requests/live while the tab is visible.
 * A change updates the badge immediately and refreshes the server tree
 * so Requests and Today re-render. A refresh waits until no bottom sheet is open.
 */
export function LiveQueue({
  initial,
  children,
}: {
  initial: LiveQueueSnapshot;
  children: ReactNode;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const snapshotRef = useRef(initial);
  const refreshWaiting = useRef(false);

  useEffect(() => {
    snapshotRef.current = initial;
    setSnapshot(initial);
  }, [initial.pendingCount, initial.latestRequestedAt]);

  useEffect(() => {
    applyAppBadge(snapshotRef.current.pendingCount);
    let timer = 0;
    let stopped = false;
    let failures = 0;
    let inFlight = false;

    function sheetOpen(): boolean {
      return (
        document.querySelector(
          '[data-slot="bottom-sheet-content"][data-state="open"]',
        ) !== null
      );
    }

    function flushRefresh() {
      if (!refreshWaiting.current || sheetOpen()) return;
      refreshWaiting.current = false;
      router.refresh();
    }

    async function tick() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/owner/requests/live", { cache: "no-store" });
        if (!response.ok) throw new Error("live queue");
        const next = (await response.json()) as LiveQueueSnapshot;
        if (
          typeof next.pendingCount !== "number" ||
          (next.latestRequestedAt !== null &&
            typeof next.latestRequestedAt !== "string")
        ) {
          throw new Error("live queue");
        }
        failures = 0;
        applyAppBadge(next.pendingCount);
        if (liveQueueChanged(snapshotRef.current, next)) {
          snapshotRef.current = next;
          setSnapshot(next);
          if (sheetOpen()) refreshWaiting.current = true;
          else router.refresh();
        }
      } catch {
        failures += 1;
      } finally {
        inFlight = false;
        arm();
      }
    }

    function arm() {
      window.clearTimeout(timer);
      if (stopped || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        void tick();
      }, nextPollDelayMs(failures));
    }

    function onShow() {
      if (document.visibilityState !== "visible") {
        window.clearTimeout(timer);
        return;
      }
      window.clearTimeout(timer);
      void tick();
    }

    const observer = new MutationObserver(() => {
      flushRefresh();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    arm();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
      observer.disconnect();
    };
  }, [router]);

  return (
    <LiveQueueContext.Provider value={snapshot}>
      {children}
    </LiveQueueContext.Provider>
  );
}

function applyAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count <= 0) {
      if (typeof nav.clearAppBadge === "function") {
        void nav.clearAppBadge().catch(() => undefined);
      }
      return;
    }
    if (typeof nav.setAppBadge === "function") {
      void nav.setAppBadge(count).catch(() => undefined);
    }
  } catch {
    // Unsupported or blocked. The tab badge still updates.
  }
}
