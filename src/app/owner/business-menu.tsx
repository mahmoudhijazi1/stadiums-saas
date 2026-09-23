"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { submitLogout } from "@/app/login/actions";
import { ShareCard } from "@/app/owner/share-card";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Avatar + name opens a share card: link, WhatsApp / QR / Copy, then log out.
 */
export function BusinessMenu({
  tenantName,
  locale,
}: {
  tenantName: string;
  locale: UiLocale;
}) {
  const [open, setOpen] = useState(false);
  const initial = Array.from(tenantName.trim())[0] ?? "•";

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

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader className="items-center pe-4 text-center">
            <span
              aria-hidden
              className="mx-auto grid size-14 place-items-center rounded-full bg-accent-brand font-heading text-xl text-accent-ink"
            >
              {initial}
            </span>
            <BottomSheetTitle className="text-center">{tenantName}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col items-center gap-4">
            <ShareCard locale={locale} />
            <form action={submitLogout} className="w-full">
              <SubmitButton
                variant="ghost"
                className="min-h-11 w-full justify-center gap-2"
              >
                <LogOut aria-hidden className="size-4" />
                {ui("owner.logout", locale)}
              </SubmitButton>
            </form>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
