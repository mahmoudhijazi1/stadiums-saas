"use client";

import { useEffect, useRef } from "react";

const HIDE_AFTER_MS = 800;
const MIN_THUMB_PX = 32;

/**
 * Overlay page scrollbar: a 3px thumb drawn over the content (it takes no width) while the
 * page scrolls, fading out shortly after. The native scrollbar is hidden in globals.css.
 * It is an indicator only: it does not take pointer events.
 */
export function ScrollbarPeek() {
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function place(): boolean {
      const thumb = thumbRef.current;
      const scrollable = root.scrollHeight - root.clientHeight;
      if (!thumb || scrollable <= 0) return false;
      const height = Math.max(MIN_THUMB_PX, (root.clientHeight * root.clientHeight) / root.scrollHeight);
      const top = (root.scrollTop / scrollable) * (root.clientHeight - height);
      thumb.style.height = `${height}px`;
      thumb.style.transform = `translateY(${top}px)`;
      return true;
    }

    function onScroll() {
      const thumb = thumbRef.current;
      if (!thumb || !place()) return;
      thumb.style.opacity = "1";
      clearTimeout(timer);
      timer = setTimeout(() => {
        thumb.style.opacity = "0";
      }, HIDE_AFTER_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={thumbRef}
      aria-hidden
      className="pointer-events-none fixed end-0.5 top-0 z-50 w-[3px] rounded-full bg-muted-foreground/60 opacity-0 transition-opacity duration-300 motion-reduce:transition-none"
    />
  );
}
