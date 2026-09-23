"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

/**
 * Public link plus WhatsApp / QR / Copy.
 * QR has no image library: the row reveals the same URL in large type.
 */
export function ShareCard({
  locale,
  showLink = true,
}: {
  locale: UiLocale;
  showLink?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/`);
  }, []);

  return (
    <div className="flex w-full flex-col gap-3">
      {showLink ? (
        <a
          href="/"
          className="min-h-11 rounded-[var(--radius-control)] px-2 py-2 text-center text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <LtrIsolate className="text-base font-medium">
            {url || "/"}
          </LtrIsolate>
        </a>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            if (!url) return;
            const href = `https://wa.me/?text=${encodeURIComponent(url)}`;
            window.open(href, "_blank", "noopener,noreferrer");
          }}
        >
          {ui("owner.shareWa", locale)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setShowQr(true)}
        >
          {ui("owner.qrShort", locale)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            if (!url) return;
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? ui("owner.copied", locale) : ui("owner.copyShort", locale)}
        </Button>
      </div>
      {showQr && url ? (
        <p className="text-center">
          <LtrIsolate className="text-lg font-medium">{url}</LtrIsolate>
        </p>
      ) : null}
    </div>
  );
}
