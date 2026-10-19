"use client";

import { LbpInput } from "@/components/ui/lbp-input";
import { ui } from "@/lib/copy";
import { lbpUnit } from "@/lib/format/money";
import type { UiLocale } from "@/lib/locale";
import { isLbpPriceString } from "@/modules/venue/domain/schedule-config";

/**
 * A pitch price in pounds: grouped digits ("2,000,000"), the pound unit beside it, and a plain
 * message when the amount is not whole pounds in steps of 5,000 (DR-007).
 */
export function LbpPriceField({
  id,
  value,
  onChange,
  locale,
  label,
}: {
  id?: string;
  value: string;
  onChange: (digits: string) => void;
  locale: UiLocale;
  label?: string;
}) {
  const invalid = value !== "" && !isLbpPriceString(value);
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2" dir="ltr">
        <LbpInput id={id} value={value} onValueChange={onChange} aria-label={label} aria-invalid={invalid || undefined} />
        <span aria-hidden className="type-body text-muted-foreground">
          {lbpUnit(locale)}
        </span>
      </div>
      {invalid ? (
        <p role="status" className="type-secondary text-owed">
          {ui("owner.pitchLbpUnit", locale)}
        </p>
      ) : null}
    </div>
  );
}
