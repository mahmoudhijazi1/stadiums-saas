"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";
import { isValidUsd, MoneyInput } from "@/components/ui/money-input";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { formatDays } from "@/modules/venue/domain/pitch-form-model";
import { LbpPriceField } from "@/app/owner/(app)/more/settings/pitches/_components/lbp-price-field";
import type { PriceCard } from "@/app/owner/(app)/more/settings/pitches/_components/price-cards";

/** A price typed in the other currency is fine when empty (none) or valid for that currency. */
export function otherPriceOk(value: string, other: GamePriceCurrency, lbpValid: (value: string) => boolean): boolean {
  if (value === "") return true;
  return other === "LBP" ? lbpValid(value) : isValidUsd(value);
}

/**
 * The prices in the stadium's OTHER currency (DR-007), collapsed by default and optional: the same
 * inputs and validation as that currency's main fields (pounds: whole pounds in steps of the unit;
 * dollars: cents), for the default price and for each price card with days. They are what lets the
 * owner switch the stadium's game currency: the switch needs a full set in the target currency.
 */
export function OtherCurrencyPrices({
  locale,
  other,
  defaultPrice,
  onDefaultPrice,
  cards,
  onCards,
  defaultOpen,
}: {
  locale: UiLocale;
  /** The currency of this section: the one the stadium does NOT price games in. */
  other: GamePriceCurrency;
  defaultPrice: string;
  onDefaultPrice: (value: string) => void;
  cards: PriceCard[];
  onCards: (cards: PriceCard[]) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pounds = other === "LBP";
  const field = (props: { id?: string; value: string; onChange: (value: string) => void; label?: string }) =>
    pounds ? (
      <LbpPriceField id={props.id} value={props.value} onChange={props.onChange} locale={locale} label={props.label} />
    ) : (
      <MoneyInput
        id={props.id}
        className="flex-1"
        value={props.value}
        onChange={props.onChange}
        label={props.label}
        invalid={props.value !== "" && !isValidUsd(props.value)}
      />
    );
  const priced = cards.filter((card) => card.days.length > 0);

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pitch-other-currency"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-start type-section outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>{ui(pounds ? "owner.pitchOtherPounds" : "owner.pitchOtherDollars", locale)}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id="pitch-other-currency" className="flex flex-col gap-3">
          <p className="type-secondary">{ui("owner.pitchOtherHint", locale)}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pitch-price-other">{ui("owner.pitchPrice", locale)}</Label>
            {field({ id: "pitch-price-other", value: defaultPrice, onChange: onDefaultPrice })}
          </div>
          {priced.map((card) => (
            <div key={card.key} className="flex flex-col gap-2">
              <p className="type-label">{formatDays(card.days, locale)}</p>
              {field({
                value: (pounds ? card.priceLbp : card.priceUsd) ?? "",
                label: ui("owner.pitchPriceRuleAmount", locale),
                onChange: (value) =>
                  onCards(
                    cards.map((item) =>
                      item.key === card.key ? (pounds ? { ...item, priceLbp: value } : { ...item, priceUsd: value }) : item,
                    ),
                  ),
              })}
            </div>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
