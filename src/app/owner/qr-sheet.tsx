"use client";

import { useState } from "react";
import { Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

function filenameFor(url: string): string {
  try {
    return `${new URL(url).hostname.split(".")[0] ?? "stadium"}-qr.png`;
  } catch {
    return "stadium-qr.png";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

/**
 * The QR of the public page: the image comes from /owner/qr (generated on the server, so
 * the library never reaches the browser). White card even in dark mode, the stadium name as
 * written, the link, and three actions: Share (primary), Download PNG, Print poster.
 */
export function QrSheet({
  open,
  onOpenChange,
  tenantName,
  url,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName: string;
  url: string;
  locale: UiLocale;
}) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const response = await fetch("/owner/qr?format=png");
      if (!response.ok) return;
      const blob = await response.blob();
      const filename = filenameFor(url);
      const file = new File([blob], filename, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: tenantName, text: url });
        } catch {
          // The owner closed the share sheet: nothing to do.
        }
        return;
      }
      downloadBlob(blob, filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{ui("owner.qrTitle", locale)}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col items-center gap-4 pb-4">
          {/* White on purpose, in dark mode too: a QR needs dark modules on a light ground. */}
          <div className="flex w-full max-w-72 flex-col items-center gap-3 rounded-2xl bg-white p-4 text-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG from our own route */}
            <img
              src="/owner/qr?format=svg"
              alt={ui("owner.qrAlt", locale)}
              width={256}
              height={256}
              className="aspect-square w-full"
            />
            <p className="type-strong text-center text-black">
              <bdi>{tenantName}</bdi>
            </p>
          </div>
          <LtrIsolate className="type-secondary text-center break-all">{url}</LtrIsolate>
          <p className="type-secondary text-center">{ui("owner.qrHint", locale)}</p>

          <div className="flex w-full flex-col gap-2">
            <Button type="button" className="w-full gap-2" onClick={share} disabled={busy}>
              <Share2 aria-hidden className="size-4" />
              {ui("owner.qrShare", locale)}
            </Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href="/owner/qr?format=png" download>
                <Download aria-hidden className="size-4" />
                {ui("owner.qrDownload", locale)}
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <a href="/owner/qr/print">
                <Printer aria-hidden className="size-4" />
                {ui("owner.qrPrint", locale)}
              </a>
            </Button>
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}
