"use client";

import Decimal from "decimal.js";
import { Minus } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact } from "@/lib/money";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

export type SellItem = { id: string; name: string; priceUsd: string };

export const QTY_MAX = 99;

/**
 * The item grid shared by the counter (Sell) and the "add items" panel of a booking: two columns of
 * tiles, tap = +1 with a count badge, a "-" once the count is above 0.
 */
export function ItemTiles({
  items,
  counts,
  onChange,
  locale,
}: {
  items: SellItem[];
  counts: Record<string, number>;
  onChange: (id: string, delta: number) => void;
  locale: UiLocale;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const qty = counts[item.id] ?? 0;
        return (
          <li key={item.id} className="relative">
            <button
              type="button"
              onClick={() => onChange(item.id, 1)}
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
                  onClick={() => onChange(item.id, -1)}
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
  );
}
