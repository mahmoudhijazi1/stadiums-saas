"use client";

import { COUNTRIES } from "@/modules/people/domain/countries";
import { sanitizePhoneInput } from "@/modules/people/domain/phone";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/** The flag emoji of a two-letter country key ("lb" gives the Lebanese flag). */
function flagOf(key: string): string {
  return [...key.toUpperCase()].map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join("");
}

/** The select's options: the dialling code and what is shown for it ("🇱🇧 +961"). */
export const PHONE_COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  code: country.code,
  label: `${flagOf(country.key)} +${country.code}`,
}));

/**
 * A country-code select (the app's Select, flag and "+code") beside the phone input. The code
 * submits as `country` (a hidden input, like SelectField) and the phone as `phone`; the whole group
 * is LTR in both languages. The parent owns the selected country (controlled) so its client check
 * can use it, and the phone box still drops anything a phone cannot contain as the user types or
 * pastes. The list is capped to about six rows and scrolls.
 */
export function PhoneField({
  locale,
  country,
  onCountryChange,
  phoneId,
  invalid = false,
  describedBy,
  defaultValue,
  onPhoneInput,
  className,
}: {
  locale: UiLocale;
  country: string;
  onCountryChange: (code: string) => void;
  phoneId: string;
  invalid?: boolean;
  describedBy?: string;
  /** The phone to start with (an edit form). */
  defaultValue?: string;
  /** Called after each edit of the phone box (to clear its error). */
  onPhoneInput?: () => void;
  className?: string;
}) {
  const selected = PHONE_COUNTRY_OPTIONS.find((option) => option.code === country);
  return (
    <div dir="ltr" className={cn("flex gap-2", className)}>
      <input type="hidden" name="country" value={country} />
      <Select dir="ltr" value={country} onValueChange={onCountryChange}>
        <SelectTrigger aria-label={ui("phone.countryCode", locale)} className="w-auto shrink-0 gap-1 px-2.5">
          <SelectValue>{selected?.label ?? `+${country}`}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="max-h-56">
          {PHONE_COUNTRY_OPTIONS.map((option) => (
            <SelectItem key={option.code} value={option.code} className="py-1">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={phoneId}
        type="tel"
        name="phone"
        defaultValue={defaultValue}
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
