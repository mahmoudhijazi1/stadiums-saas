"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { groupedDigits } from "@/lib/copy";

/** Latin digits only: Arabic-Indic and Persian digits are converted, everything else dropped. */
export function toLbpDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

type LbpInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type" | "name"
> & {
  /** Controlled value: digits only ("2700000"). */
  value?: string;
  defaultValue?: string;
  /** Gets the digits only, never the commas. */
  onValueChange?: (digits: string) => void;
  /** Submitted as a hidden field holding the digits, so no server code ever sees a comma. */
  name?: string;
};

/**
 * A whole-pounds field that shows thousands commas as the owner types ("2,700,000") while the
 * value everywhere else (state, forms, the server) stays plain digits ("2700000"). Left to
 * right, numeric keypad, the caret stays on the same digit when the commas move.
 */
export function LbpInput({ value, defaultValue = "", onValueChange, name, ...rest }: LbpInputProps) {
  const [inner, setInner] = useState(() => toLbpDigits(defaultValue));
  const digits = value !== undefined ? toLbpDigits(value) : inner;
  const shown = groupedDigits(digits);
  const ref = useRef<HTMLInputElement>(null);
  const caretAfterDigits = useRef<number | null>(null);

  // After the commas are re-inserted, put the caret back after the same number of digits.
  useLayoutEffect(() => {
    const wanted = caretAfterDigits.current;
    const input = ref.current;
    if (wanted === null || !input) return;
    caretAfterDigits.current = null;
    let seen = 0;
    let position = 0;
    while (position < shown.length && seen < wanted) {
      if (shown[position] !== ",") seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  return (
    <>
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        value={shown}
        onChange={(event) => {
          const raw = event.target.value;
          const caret = event.target.selectionStart ?? raw.length;
          caretAfterDigits.current = toLbpDigits(raw.slice(0, caret)).length;
          const next = toLbpDigits(raw);
          setInner(next);
          onValueChange?.(next);
        }}
      />
      {name ? <input type="hidden" name={name} value={digits} /> : null}
    </>
  );
}
