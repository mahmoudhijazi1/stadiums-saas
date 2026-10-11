"use client";

import { COUNTRIES } from "@/modules/people/domain/countries";
import { sanitizePhoneInput } from "@/modules/people/domain/phone";
import { Input } from "@/components/ui/input";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/** The flag emoji of a two-letter country key ("lb" gives the Lebanese flag). */
function flagOf(key: string): string {
  return [...key.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
}

/**
 * A country-code select (native, flag and "+code") beside the phone input. The select submits as
 * `country`, the input as `phone`; the whole group is LTR in both languages. The parent owns the
 * selected country (controlled) so its client check can use it, and the phone box still drops
 * anything a phone cannot contain as the user types or pastes.
 */
export function PhoneField({
  locale,
  country,
  onCountryChange,
  phoneId,
  invalid = false,
  describedBy,
  onPhoneInput,
  className,
}: {
  locale: UiLocale;
  country: string;
  onCountryChange: (code: string) => void;
  phoneId: string;
  invalid?: boolean;
  describedBy?: string;
  /** Called after each edit of the phone box (to clear its error). */
  onPhoneInput?: () => void;
  className?: string;
}) {
  return (
    <div dir="ltr" className={cn("flex gap-2", className)}>
      <select
        name="country"
        value={country}
        aria-label={ui("phone.countryCode", locale)}
        onChange={(event) => onCountryChange(event.target.value)}
        className="type-field h-11 shrink-0 rounded-md border border-input bg-transparent px-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {COUNTRIES.map((item) => (
          <option key={item.code} value={item.code}>
            {`${flagOf(item.key)} +${item.code}`}
          </option>
        ))}
      </select>
      <Input
        id={phoneId}
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        className="min-w-0 flex-1 font-mono"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onInput={(event) => {
          // Digits and + - ( ) . only: letters never get into the box.
          const input = event.currentTarget;
          const clean = sanitizePhoneInput(input.value);
          if (clean !== input.value) input.value = clean;
          onPhoneInput?.();
        }}
      />
    </div>
  );
}
