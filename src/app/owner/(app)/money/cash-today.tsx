"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatLbpAmount, formatUsdAmount } from "@/lib/format/money";
import { ui } from "@/lib/copy";

/** Plain strings: this crosses to the client. Amounts are decimals as text, in their own currency. */
export type CashTodayView = {
  net: { USD: string; LBP: string };
  in: { USD: string; LBP: string };
  out: { USD: string; LBP: string };
  /** The currencies the line shows (non-zero nets; USD alone when everything is zero). */
  shown: ("USD" | "LBP")[];
};

/** One amount in its own currency; a negative net keeps its minus sign. */
function money(currency: "USD" | "LBP", value: string, locale: UiLocale): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const text = currency === "USD" ? formatUsdAmount(digits) : formatLbpAmount(digits, locale);
  return negative ? `−${text}` : text;
}

/**
 * "Cash today: $140 · 2,700,000 ل.ل": the NET cash for the current business day, one figure per
 * currency, never converted and never combined. A tap opens a small sheet with in and out per
 * currency. A count of notes for one day, not a value (docs/domain/money.md, "Cash today").
 */
export function CashToday({ view, locale }: { view: CashTodayView; locale: UiLocale }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-card px-4 text-start type-body outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Banknote aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          {ui("owner.cashToday", locale)}:{" "}
          {view.shown.map((currency, index) => (
            <span key={currency}>
              {index > 0 ? <span aria-hidden> · </span> : null}
              <LtrIsolate className="type-strong">{money(currency, view.net[currency], locale)}</LtrIsolate>
            </span>
          ))}
        </span>
      </button>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.cashToday", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            {(["USD", "LBP"] as const).map((currency) => (
              <div key={currency} className="flex flex-col gap-1 rounded-xl border p-3">
                <p className="type-label">{currency === "USD" ? ui("owner.usd", locale) : ui("owner.lbp", locale)}</p>
                <Row label={ui("owner.in", locale)} value={money(currency, view.in[currency], locale)} />
                <Row label={ui("owner.out", locale)} value={money(currency, view.out[currency], locale)} />
                <Row label={ui("owner.cashNet", locale)} value={money(currency, view.net[currency], locale)} strong />
              </div>
            ))}
            <p className="type-caption">{ui("owner.cashTodayNote", locale)}</p>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="type-secondary">{label}</span>
      <LtrIsolate className={strong ? "type-strong" : "type-body"}>{value}</LtrIsolate>
    </div>
  );
}
