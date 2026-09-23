"use client";

import { useEffect, useState } from "react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * "بدون اتصال" only while the browser is offline. Absent when online,
 * including the first server render, so the header does not flash the pill.
 */
export function OfflinePill({ locale }: { locale: UiLocale }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <p className="mx-auto mt-2 w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink lg:ms-8 lg:me-auto">
      {ui("owner.offline", locale)}
    </p>
  );
}
