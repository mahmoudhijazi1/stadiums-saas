"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ui } from "@/lib/ui-copy";
import type { UiLocale } from "@/lib/locale";

/**
 * Back control for nested owner pages. Chevron points to the inline start.
 * `history`: go back to wherever the owner came from (a past Today day, a search) and use
 * `href` only when there is nothing to go back to (a fresh tab, a shared link).
 */
export function OwnerBackLink({
  href,
  locale,
  history = false,
}: {
  href: string;
  locale: UiLocale;
  history?: boolean;
}) {
  const router = useRouter();
  const label = ui("owner.back", locale);
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (!history || window.history.length <= 1) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        router.back();
      }}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronLeft aria-hidden className="size-5 shrink-0 rtl:rotate-180" />
      {label}
    </Link>
  );
}
