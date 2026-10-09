"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { Minus } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatLbpAmount, formatUsdAmount } from "@/lib/money-display";
import { ui } from "@/lib/ui-copy";
import { cn } from "cn";

/** An item as the grids show it: the price is a USD amount ("1.50") or whole pounds ("20000"). */
export type SellItem = { id: string; name: string; currency: "USD" | "LBP"; price: string };

export const QTY_MAX = 99;

/** The price tag in the item's own currency: "20,000 ل.ل" or "$1.50". */
export function priceLabel(item: Pick<SellItem, "currency" | "price">, locale: UiLocale): string {
  return item.currency === "LBP" ? formatLbpAmount(item.price, locale) : formatUsdAmount(item.price);
}

/** What the counted items come to: pounds for the LBP items, dollars for the USD items. */
export function partsOf(items: readonly SellItem[], counts: Record<string, number>): { lbp: Decimal; usd: Decimal } {
  let lbp = new Decimal(0);
  let usd = new Decimal(0);
  for (const item of items) {
    const qty = counts[item.id] ?? 0;
    if (qty === 0) continue;
    const line = new Decimal(item.price).times(qty);
    if (item.currency === "LBP") lbp = lbp.plus(line);
    else usd = usd.plus(line);
  }
  return { lbp, usd };
}

/**
 * The item grid shared by the counter (Sell) and the "add items" panel of a booking: two columns of
 * tiles, tap = +1 with a count badge, a "-" once the count is above 0. An item priced in LBP cannot
 * be sold while no exchange rate is set (its tile is disabled and says so once, with a link).
 */
export function ItemTiles({
  items,
  counts,
  onChange,
  locale,
  rateKnown,
}: {
  items: SellItem[];
  counts: Record<string, number>;
  onChange: (id: string, delta: number) => void;
  locale: UiLocale;
  rateKnown: boolean;
}) {
  const blocked = (item: SellItem) => item.currency === "LBP" && !rateKnown;
  return (
    <div className="flex flex-col gap-2">
      {!rateKnown && items.some((item) => item.currency === "LBP") ? (
        <p className="type-secondary text-owed">
          {ui("owner.rateFirst", locale)}{" "}
          <Link href="/owner/more/settings" className="underline underline-offset-2">
            {ui("owner.rateFirstLink", locale)}
          </Link>
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const qty = counts[item.id] ?? 0;
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => onChange(item.id, 1)}
                disabled={qty >= QTY_MAX || blocked(item)}
                aria-label={`${item.name} ${priceLabel(item, locale)}`}
                className={cn(
                  "flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border bg-card px-3 py-2 text-start outline-none transition-colors active:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
                  qty > 0 && "border-action-ink",
                )}
              >
                <span className="type-strong line-clamp-2 break-words">
                  <bdi>{item.name}</bdi>
                </span>
                <span className="type-secondary">
                  <LtrIsolate>{priceLabel(item, locale)}</LtrIsolate>
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
    </div>
  );
}
