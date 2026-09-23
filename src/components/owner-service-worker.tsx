"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registers the owner worker. Scope stays under /owner/ on this origin. */
export function OwnerServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/owner")) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/owner/" });
  }, [pathname]);

  return null;
}
