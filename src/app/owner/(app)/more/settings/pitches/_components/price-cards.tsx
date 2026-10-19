"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import {
  formatClock,
  formatDays,
  type HourCycleChoice,
  type TimedRule,
} from "@/modules/venue/domain/pitch-form-model";
import { MAX_PRICE_RULES } from "@/modules/venue/schemas/pitch-draft";
import { WEEKDAYS, type Weekday } from "@/modules/venue/domain/schedule-config";
import { isValidUsd, MoneyInput } from "@/components/ui/money-input";
import { formatPrice } from "@/lib/format/money";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { isLbpPriceString } from "@/modules/venue/domain/schedule-config";
import { LbpPriceField } from "@/app/owner/(app)/more/settings/pitches/_components/lbp-price-field";

/** `priceLbp` rides along in a USD stadium, and `priceUsd` in an LBP one (DR-007). */
export type PriceCard = { key: string; days: Weekday[]; priceUsd: string; priceLbp?: string };

/**
 * "Different price on some days": one card per price, each day in at most one card (a day
 * another card uses is disabled here), so there is no overlap to explain. Rules with a
 * time range cannot be edited here; they are kept and listed read-only.
 */
export function PriceCards({
  locale,
  cards,
  onChange,
  timed,
  hourCycle,
  currency,
}: {
  locale: UiLocale;
  cards: PriceCard[];
  onChange: (cards: PriceCard[]) => void;
  timed: TimedRule[];
  hourCycle: HourCycleChoice;
  /** The stadium's gamePriceCurrency: which price each card edits. */
  currency: GamePriceCurrency;
}) {
  const inLbp = currency === "LBP";
  const [confirming, setConfirming] = useState<string | null>(null);
  // A kept timed rule shows its price in the stadium's currency, or says it has none in it.
  const timedPrice = (rule: TimedRule["rule"]): string | null => {
    const amount = inLbp ? rule.priceLbp : rule.priceUsd;
    return amount === undefined ? null : inLbp ? formatPrice({ currency: "LBP", amount }, locale) : `$${amount}`;
  };
  const used = new Set(cards.flatMap((card) => card.days));

  function patch(key: string, change: Partial<PriceCard>) {
    onChange(cards.map((card) => (card.key === key ? { ...card, ...change } : card)));
  }

  function add() {
    if (cards.length >= MAX_PRICE_RULES || used.size === WEEKDAYS.length) return;
    onChange([...cards, { key: `new-${Date.now()}-${cards.length}`, days: [], priceUsd: "" }]);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 type-section">
        {ui("owner.pitchPriceRules", locale)}
      </legend>
      <ul className="flex flex-col gap-3">
        {cards.map((card) => {
          const priceInvalid = !inLbp && card.priceUsd !== "" && !isValidUsd(card.priceUsd);
          const priced = inLbp ? isLbpPriceString(card.priceLbp ?? "") : isValidUsd(card.priceUsd);
          const incomplete = card.days.length > 0 && !priced;
          return (
            <li key={card.key} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const on = card.days.includes(day);
                  const blocked = used.has(day) && !on;
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      disabled={blocked}
                      onClick={() =>
                        patch(card.key, {
                          days: on ? card.days.filter((item) => item !== day) : [...card.days, day],
                        })
                      }
                      className={cn(
                        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        on ? "border-transparent bg-selected text-selected-ink" : "bg-card",
                        blocked && "opacity-40",
                      )}
                    >
                      {ui(`owner.wd.${day}`, locale)}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                {inLbp ? (
                  <LbpPriceField
                    value={card.priceLbp ?? ""}
                    label={ui("owner.pitchPriceRuleAmount", locale)}
                    locale={locale}
                    onChange={(priceLbp) => patch(card.key, { priceLbp })}
                  />
                ) : (
                  <MoneyInput
                    className="flex-1"
                    value={card.priceUsd}
                    label={ui("owner.pitchPriceRuleAmount", locale)}
                    invalid={priceInvalid}
                    onChange={(priceUsd) => patch(card.key, { priceUsd })}
                  />
                )}
                {confirming === card.key ? (
                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-alert"
                      onClick={() => {
                        onChange(cards.filter((item) => item.key !== card.key));
                        setConfirming(null);
                      }}
                    >
                      {ui("owner.pitchPriceRuleConfirmDelete", locale)}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setConfirming(null)}>
                      {ui("owner.notNow", locale)}
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setConfirming(card.key)}
                  >
                    {ui("owner.pitchPriceRuleRemove", locale)}
                  </Button>
                )}
              </div>
              {incomplete ? (
                <p role="status" className="type-secondary text-owed">
                  {ui("owner.pitchPriceNeeded", locale)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {timed.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed p-3 type-secondary">
          <p className="type-label">{ui("owner.pitchKeptRules", locale)}</p>
          {timed.map(({ rule }, index) => (
            <p key={index}>
              {formatDays(rule.days, locale)}{" "}
              <LtrIsolate>
                {formatClock(rule.start ?? "00:00", hourCycle, locale)}–{formatClock(rule.end ?? "00:00", hourCycle, locale)}
              </LtrIsolate>
              {" · "}
              {timedPrice(rule) ? <LtrIsolate>{timedPrice(rule)}</LtrIsolate> : ui("owner.pitchSetLbpPrices", locale)}
            </p>
          ))}
        </div>
      ) : null}

      {cards.length < MAX_PRICE_RULES && used.size < WEEKDAYS.length ? (
        <Button type="button" variant="secondary" onClick={add}>
          {ui("owner.pitchPriceRuleAdd", locale)}
        </Button>
      ) : null}
    </fieldset>
  );
}
