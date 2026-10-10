"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { submitLogout } from "@/app/owner/login/actions";
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
  publicUrl,
  locale,
  logoSrc,
}: {
  tenantName: string;
  publicUrl: string;
  locale: UiLocale;
  /** The stadium's generated logo (/brand/icon/192, versioned). */
  logoSrc: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--radius-control)] pe-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-accent-brand"
        aria-label={ui("owner.businessMenu", locale)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
        <img src={logoSrc} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full" />
        <span className="truncate font-heading text-base leading-tight font-medium">
          {tenantName}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 opacity-70" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader className="items-center pe-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
            <img src={logoSrc} alt="" width={56} height={56} className="mx-auto size-14 rounded-full" />
            <BottomSheetTitle className="text-center">{tenantName}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col items-center gap-4">
            <ShareCard locale={locale} tenantName={tenantName} publicUrl={publicUrl} />
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
