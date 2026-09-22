"use client";

import { useEffect, useState } from "react";
import { submitLogout } from "@/app/login/actions";
import { LangToggle } from "@/components/lang-toggle";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { cn } from "cn";
import { LogOut } from "lucide-react";

/**
 * Sticky owner chrome — same floating card language as OwnerTabBar
 * (rounded-2xl, border, bg-card/95, shadow, blur).
 */
export function OwnerHeader({
  tenantName,
  roleLabel,
  identifier,
  logoutLabel,
  locale,
}: {
  tenantName: string;
  roleLabel: string;
  identifier: string;
  logoutLabel: string;
  locale: UiLocale;
}) {
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setElevated(window.scrollY > 6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md",
          "transition-[box-shadow,transform] duration-300 ease-out",
          elevated && "shadow-xl",
        )}
      >
        <div className="min-w-0">
          <p className="truncate font-heading text-base leading-tight font-medium tracking-tight">
            {tenantName}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {roleLabel}
            <span aria-hidden className="mx-1 text-muted-foreground/50">
              ·
            </span>
            <LtrIsolate>{identifier}</LtrIsolate>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <LangToggle
            locale={locale}
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          />
          <form action={submitLogout}>
            <SubmitButton
              variant="ghost"
              size="icon-sm"
              aria-label={logoutLabel}
              className="group rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4 transition-transform duration-200 group-hover:scale-105" />
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
