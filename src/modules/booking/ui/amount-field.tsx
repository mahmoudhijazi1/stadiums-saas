"use client";

import Decimal from "decimal.js";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/copy/errors";
import { currencyLabel } from "@/lib/format/money";
import { normalizeUsdForm, parseUsd } from "@/lib/format/parse-money";
import type { UiLocale } from "@/lib/locale";
import { moneyUnit } from "@/modules/payment/domain/units";

/** What the owner typed, when it is a valid amount of the currency: cents in dollars, whole pounds in pounds. */
export function typedAmount(currency: "USD" | "LBP", raw: string): Decimal | null {
  const text = raw.trim();
  if (currency === "LBP") return /^(?:0|[1-9]\d*)$/.test(text) ? new Decimal(text) : null;
  const normalized = normalizeUsdForm(text);
  return /^(?:0|[1-9]\d*)\.\d{2}$/.test(normalized) ? parseUsd(normalized) : null;
}

/** A pound amount that is not a whole number of money units (the server refuses it with `booking.fee_unit`). */
export function offUnit(currency: "USD" | "LBP", raw: string): boolean {
  const value = typedAmount(currency, raw);
  return currency === "LBP" && value !== null && !value.mod(moneyUnit("LBP")).isZero();
}

/**
 * An amount in the game's currency: the label, the field with the currency label always visible beside it
 * (`currencyLabel`), digits grouped while typing in pounds, 16px type, and the existing unit error under
 * the field when pounds are not a multiple of the money unit. Submitted under `name` as plain digits.
 */
export function AmountField({
  id,
  name,
  label,
  currency,
  value,
  onValueChange,
  locale,
}: {
  id: string;
  name: string;
  label: string;
  currency: "USD" | "LBP";
  value: string;
  onValueChange: (value: string) => void;
  locale: UiLocale;
}) {
  const unitError = offUnit(currency, value);
  const errorId = `${id}-unit`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2" dir="ltr">
        {currency === "USD" ? (
          <span className="type-strong text-muted-foreground">{currencyLabel(currency, locale)}</span>
        ) : null}
        {currency === "LBP" ? (
          <LbpInput id={id} name={name} value={value} onValueChange={onValueChange} aria-invalid={unitError || undefined} aria-describedby={unitError ? errorId : undefined} />
        ) : (
          <Input
            id={id}
            name={name}
            type="text"
            required
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        )}
        {currency === "LBP" ? (
          <span className="shrink-0 type-strong text-muted-foreground">{currencyLabel(currency, locale)}</span>
        ) : null}
      </div>
      {unitError ? (
        <p id={errorId} role="alert" className="type-secondary text-owed">
          {errorMessage("booking.fee_unit", locale)}
        </p>
      ) : null}
    </div>
  );
}
