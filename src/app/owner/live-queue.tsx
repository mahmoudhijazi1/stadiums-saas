"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CountedPhrase } from "@/app/owner/notify-list";
import {
  liveQueueChanged,
  nextPollDelayMs,
  reconcileAfterRefresh,
  type LiveQueueSnapshot,
} from "@/modules/booking/domain/live-queue";
import type { UiLocale } from "@/lib/locale";
import { uiCount } from "@/lib/copy";

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
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Set by the poll effect. Lets a finished action ask for a poll right now.
  const pollNow = useRef<() => void>(() => undefined);
  const [snapshot, setSnapshot] = useState(initial);
  const snapshotRef = useRef(initial);
  const refreshWaiting = useRef(false);

  // A refresh we started, waiting for its render. router.refresh() returns
  // void, so the next new `initial` object is how we see it land.
  const awaitingRender = useRef(false);
  const reconcileAttempts = useRef(0);

  useEffect(() => {
    if (awaitingRender.current) {
      awaitingRender.current = false;
      const action = reconcileAfterRefresh(
        initial,
        snapshotRef.current,
        reconcileAttempts.current,
      );
      if (action === "retry") {
        // The render is behind the poll. Keep the poll's snapshot, ask again.
        reconcileAttempts.current += 1;
        awaitingRender.current = true;
        router.refresh();
        return;
      }
      reconcileAttempts.current = 0;
      if (action === "accept") return;
    }
    snapshotRef.current = initial;
    setSnapshot(initial);
  }, [initial, router]);

  useEffect(() => {
    applyAppBadge(snapshotRef.current.pendingCount);
    let timer = 0;
    let stopped = false;
    let failures = 0;
    let inFlight = false;
    let pollAgain = false;

    function sheetOpen(): boolean {
      return (
        document.querySelector(
          '[data-slot="bottom-sheet-content"][data-state="open"]',
        ) !== null
      );
    }

    function startRefresh() {
      reconcileAttempts.current = 0;
      awaitingRender.current = true;
      router.refresh();
    }

    function flushRefresh() {
      if (!refreshWaiting.current || sheetOpen()) return;
      refreshWaiting.current = false;
      startRefresh();
    }

    async function tick() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/owner/requests/live", { cache: "no-store" });
        if (response.status === 403) {
          // Tenant suspended by the platform: its own page, never login (no loop).
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (body?.error === "tenant_suspended") {
            stopped = true;
            router.replace("/owner/suspended");
            return;
          }
        }
        if (response.status === 401) {
          // Session expired. Same destination as requireOwnerMembership.
          stopped = true;
          router.replace("/owner/login");
          return;
        }
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
          else startRefresh();
        }
      } catch {
        failures += 1;
      } finally {
        inFlight = false;
        if (pollAgain && !stopped) {
          pollAgain = false;
          void tick();
        } else {
          arm();
        }
      }
    }

    function arm() {
      window.clearTimeout(timer);
      if (stopped || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        void tick();
      }, nextPollDelayMs(failures));
    }

    // A poll already in flight may have read before the action committed,
    // so ask for one more when it lands.
    pollNow.current = () => {
      if (inFlight) {
        pollAgain = true;
        return;
      }
      window.clearTimeout(timer);
      void tick();
    };

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

  // Approve, reject and dismiss redirect to a new URL and leave this layout
  // as it was, so the badge would wait for the next 20s tick. A URL change
  // is the signal that an action finished: poll now.
  const firstUrl = useRef(true);
  useEffect(() => {
    if (firstUrl.current) {
      firstUrl.current = false;
      return;
    }
    pollNow.current();
  }, [pathname, search]);

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
