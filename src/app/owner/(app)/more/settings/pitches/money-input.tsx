"use client";

import { Input } from "@/components/ui/input";
import { cn } from "cn";

/** Digits and at most one ".", at most two decimals. String only: no floats, no rounding. */
export function sanitizeUsd(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

/** "25" -> "25.00", "25.5" -> "25.50", "25." -> "25.00"; anything else is returned as typed. */
export function padCents(value: string): string {
  if (/^\d+$/.test(value)) return `${value}.00`;
  const match = /^(\d+)\.(\d{0,2})$/.exec(value);
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}` : value;
}

export function isValidUsd(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

/** A currency field: "$" prefix, exact cents, normalised to two decimals on blur. */
export function MoneyInput({
  value,
  onChange,
  id,
  name,
  label,
  invalid,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  name?: string;
  label?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)} dir="ltr">
      <span aria-hidden className="type-body text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(sanitizeUsd(event.target.value))}
        onBlur={() => onChange(padCents(value))}
      />
    </div>
  );
}
