"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import { submitLogout } from "@/app/login/actions";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

const rowClass =
  "flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-3 text-start text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50";

function publicUrl(): string {
  return `${window.location.origin}/`;
}

/**
 * Avatar + name opens the business menu. Language, theme, and log out live under Account.
 * No switch-business row.
 */
export function BusinessMenu({
  tenantName,
  locale,
  showSettings,
}: {
  tenantName: string;
  locale: UiLocale;
  showSettings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const initial = Array.from(tenantName.trim())[0] ?? "•";

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--radius-control)] pe-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-accent-brand"
        aria-label={ui("owner.businessMenu", locale)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-brand font-heading text-sm text-accent-ink"
        >
          {initial}
        </span>
        <span className="truncate font-heading text-base leading-tight font-medium">
          {tenantName}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 opacity-70" />
      </button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setCopied(false);
            setQrUrl(null);
          }
        }}
      >
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{tenantName}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4">
            <section className="flex flex-col gap-1">
              <h3 className="px-3 text-xs font-medium text-muted-foreground">
                {ui("owner.publicPage", locale)}
              </h3>
              <Link href="/" className={rowClass} onClick={close}>
                {ui("owner.openPublic", locale)}
              </Link>
              <button
                type="button"
                className={rowClass}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicUrl());
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? ui("owner.copied", locale) : ui("owner.copyLink", locale)}
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => setQrUrl(publicUrl())}
              >
                {ui("owner.showQr", locale)}
              </button>
              {qrUrl ? (
                <p className="px-3 text-sm">
                  <LtrIsolate className="text-base font-medium">{qrUrl}</LtrIsolate>
                </p>
              ) : null}
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  const href = `https://wa.me/?text=${encodeURIComponent(publicUrl())}`;
                  window.open(href, "_blank", "noopener,noreferrer");
                }}
              >
                {ui("owner.shareWhatsApp", locale)}
              </button>
            </section>

            {showSettings ? (
              <Link
                href="/owner/more/settings"
                className={rowClass}
                onClick={close}
              >
                {ui("owner.settings", locale)}
              </Link>
            ) : null}

            <section className="flex flex-col gap-1">
              <h3 className="px-3 text-xs font-medium text-muted-foreground">
                {ui("owner.account", locale)}
              </h3>
              <div className="flex flex-col items-start gap-2 px-3">
                <ThemeToggle locale={locale} className="flex w-full" />
                <LangToggle locale={locale} variant="outline" size="sm" />
              </div>
              <form action={submitLogout}>
                <SubmitButton
                  variant="ghost"
                  className="min-h-11 w-full justify-start gap-2 px-3"
                >
                  <LogOut aria-hidden className="size-4" />
                  {ui("owner.logout", locale)}
                </SubmitButton>
              </form>
            </section>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
