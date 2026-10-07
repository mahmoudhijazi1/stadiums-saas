"use client";

import { useEffect } from "react";

const HIDE_AFTER_MS = 800;

/**
 * Sets `data-scrolling` on <html> while the page scrolls and removes it shortly after the
 * scrolling stops. globals.css shows the thin page scrollbar only while it is set.
 */
export function ScrollbarPeek() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      root.setAttribute("data-scrolling", "");
      clearTimeout(timer);
      timer = setTimeout(() => root.removeAttribute("data-scrolling"), HIDE_AFTER_MS);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      root.removeAttribute("data-scrolling");
    };
  }, []);
  return null;
}
