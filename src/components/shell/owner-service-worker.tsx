"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Only the owner area registers the worker, and never the platform admin (DR-006): /platform and
 * everything under it is excluded explicitly, whatever else the rule becomes.
 */
export function shouldRegisterOwnerWorker(pathname: string): boolean {
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return false;
  return pathname.startsWith("/owner");
}

/** Registers the owner worker. Scope stays under /owner/ on this origin. */
export function OwnerServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldRegisterOwnerWorker(pathname)) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/owner/" });
  }, [pathname]);

  return null;
}
