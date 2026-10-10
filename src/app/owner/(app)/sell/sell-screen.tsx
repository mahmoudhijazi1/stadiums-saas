"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ItemTiles, QTY_MAX, partsOf, type SellItem } from "@/app/owner/item-tiles";
import { PartsBalance } from "@/app/owner/parts-balance";
import { TonalCollectButton } from "@/app/owner/tonal-collect";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatParts } from "@/lib/format/money";
import { changeDescription, soldToast, ui } from "@/lib/ui-copy";
import { submitWalkInSale } from "./actions";

export type { SellItem };

/**
 * The counter: a grid of item tiles (tap = +1 with a count badge, a "-" button once the count is above
 * 0), a bar with the total and one primary "Collect", and the tender sheet (LBP / USD) for it. The
 * total is shown in the currencies of the items ("60,000 ل.ل + $1.50") and the sheet is prefilled with
 * exactly those parts, so the common case is one tap. Only ids and quantities go to the server: it
 * reads the prices itself. A sale must be settled in full.
 */
export function SellScreen({
  items,
  lbpPerUsd,
  locale,
}: {
  items: SellItem[];
  lbpPerUsd: string | null;
  locale: UiLocale;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = items
    .map((item) => ({ item, qty: counts[item.id] ?? 0 }))
    .filter((line) => line.qty > 0);
  const parts = partsOf(items, counts);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const totalText = formatParts(parts, locale);

  function change(id: string, delta: number) {
    setCounts((current) => {
      const next = Math.min(QTY_MAX, Math.max(0, (current[id] ?? 0) + delta));
      return { ...current, [id]: next };
    });
  }

  function startPaying() {
    setUsd(parts.usd.gt(0) ? parts.usd.toFixed(2) : "");
    setLbp(parts.lbp.gt(0) ? parts.lbp.toFixed(0) : "");
    setError(null);
    setPaying(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitWalkInSale({
        lines: lines.map((line) => ({ productId: line.item.id, qty: line.qty })),
        usdAmount: usd,
        lbpAmount: lbp,
      });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      toast.success(
        soldToast(result.itemCount, formatParts({ lbp: result.totalLbp, usd: result.totalUsdPart }, locale), locale),
        {
          description: changeDescription({ lbp: result.changeLbp, usd: result.changeUsd }, locale, lbpPerUsd),
          duration: 8000,
        },
      );
      setPaying(false);
      if (window.history.length > 1) router.back();
      else router.push("/owner/today");
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-40">
      <ItemTiles items={items} counts={counts} onChange={change} locale={locale} rateKnown={lbpPerUsd !== null} />

      {/* Above the floating nav and its safe-area inset. */}
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-lg px-3 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2 ps-4 shadow-lg">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="type-caption">{ui("owner.sellTotal", locale)}</span>
            <span className="type-strong">
              <LtrIsolate>{totalText}</LtrIsolate>
            </span>
          </div>
          {/* The same Collect button as a tab or a game in the booking sheet: bordered ink pill. */}
          <TonalCollectButton tone="expected" disabled={itemCount === 0} onClick={startPaying}>
            {ui("owner.collect", locale)}
          </TonalCollectButton>
        </div>
      </div>

      <BottomSheet open={paying} onOpenChange={setPaying}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.sell", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            <p className="type-strong">
              {ui("owner.sellTotal", locale)}: <LtrIsolate>{totalText}</LtrIsolate>
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sale-lbp">{ui("owner.lbp", locale)}</Label>
              <LbpInput id="sale-lbp" value={lbp} onValueChange={setLbp} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sale-usd">USD</Label>
              <Input
                id="sale-usd"
                inputMode="decimal"
                autoComplete="off"
                value={usd}
                onChange={(event) => setUsd(event.target.value)}
              />
            </div>
            <PartsBalance owed={parts} usdText={usd} lbpText={lbp} lbpPerUsd={lbpPerUsd} locale={locale} />
            {error ? (
              <p role="alert" className="type-secondary text-owed">
                {error}
              </p>
            ) : null}
            <Button type="button" className="w-full" onClick={submit} disabled={pending}>
              {ui("owner.collect", locale)} <LtrIsolate>{totalText}</LtrIsolate>
            </Button>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
