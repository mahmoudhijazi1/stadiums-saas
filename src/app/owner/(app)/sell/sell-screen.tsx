"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { Minus } from "lucide-react";
import { toast } from "sonner";
import { TenderBalance } from "@/app/owner/tender-balance";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";
import { soldToast, ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { submitWalkInSale } from "./actions";

export type SellItem = { id: string; name: string; priceUsd: string };

const QTY_MAX = 99;

/**
 * The counter: a grid of item tiles (tap = +1 with a count badge, a "−" once the count is above 0),
 * a bar with the total and one primary "Collect $X", and the tender sheet (USD / LBP, live
 * remaining, frozen rate) for that total. Only ids and quantities go to the server: it reads the
 * prices itself. A sale must be paid in full; more than the total is accepted.
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
  const total = lines.reduce((sum, line) => sum.plus(new Decimal(line.item.priceUsd).times(line.qty)), new Decimal(0));
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const totalText = total.toFixed(2);

  function change(id: string, delta: number) {
    setCounts((current) => {
      const next = Math.min(QTY_MAX, Math.max(0, (current[id] ?? 0) + delta));
      return { ...current, [id]: next };
    });
  }

  function startPaying() {
    setUsd(totalText);
    setLbp("");
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
      toast.success(soldToast(result.itemCount, formatUsdCompact(new Decimal(result.totalUsd)), locale));
      setPaying(false);
      if (window.history.length > 1) router.back();
      else router.push("/owner/today");
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-40">
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const qty = counts[item.id] ?? 0;
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => change(item.id, 1)}
                disabled={qty >= QTY_MAX}
                aria-label={`${item.name} ${item.priceUsd}`}
                className={cn(
                  "flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border bg-card px-3 py-2 text-start outline-none transition-colors active:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  qty > 0 && "border-action-ink",
                )}
              >
                <span className="type-strong line-clamp-2 break-words">
                  <bdi>{item.name}</bdi>
                </span>
                <span className="type-secondary">
                  <LtrIsolate>{`$${formatUsdCompact(new Decimal(item.priceUsd))}`}</LtrIsolate>
                </span>
              </button>
              {qty > 0 ? (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute end-2 top-2 grid min-w-6 place-items-center rounded-full bg-action-ink px-1.5 type-label text-background"
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => change(item.id, -1)}
                    aria-label={`${ui("owner.sellMinus", locale)} ${item.name}`}
                    className="absolute end-1 bottom-1 grid size-11 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Minus aria-hidden className="size-5" />
                  </button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Above the floating nav and its safe-area inset. */}
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-lg px-3 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2 ps-4 shadow-lg">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="type-caption">{ui("owner.sellTotal", locale)}</span>
            <span className="type-strong">
              <LtrIsolate>{`$${formatUsdCompact(total)}`}</LtrIsolate>
            </span>
          </div>
          <Button type="button" className="min-h-11 shrink-0" disabled={itemCount === 0} onClick={startPaying}>
            {ui("owner.collect", locale)} <LtrIsolate>{`$${formatUsdCompact(total)}`}</LtrIsolate>
          </Button>
        </div>
      </div>

      <BottomSheet open={paying} onOpenChange={setPaying}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.sell", locale)}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sale-usd">{ui("owner.usdRemaining", locale)}</Label>
              <Input
                id="sale-usd"
                inputMode="decimal"
                autoComplete="off"
                value={usd}
                onChange={(event) => setUsd(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sale-lbp">{ui("owner.lbp", locale)}</Label>
              <Input
                id="sale-lbp"
                inputMode="numeric"
                autoComplete="off"
                value={lbp}
                onChange={(event) => setLbp(event.target.value)}
              />
            </div>
            <TenderBalance
              usdText={usd}
              lbpText={lbp}
              lbpPerUsd={lbpPerUsd}
              targetUsd={totalText}
              locale={locale}
              onFillLbp={setLbp}
            />
            {error ? (
              <p role="alert" className="type-secondary text-owed">
                {error}
              </p>
            ) : null}
            <Button type="button" className="w-full" onClick={submit} disabled={pending}>
              {ui("owner.collect", locale)} <LtrIsolate>{`$${formatUsdCompact(total)}`}</LtrIsolate>
            </Button>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
