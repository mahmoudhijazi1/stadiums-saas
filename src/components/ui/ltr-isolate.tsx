import type { ComponentProps } from "react"
import { cn } from "cn"
import {
  splitDisplayedClock,
  type ClockRangeLabel,
} from "@/lib/format-local-hm"

/**
 * Isolate a Latin run (times, phones, money, yyyy-mm-dd) inside dir="rtl".
 * Display face + tabular-nums for comparable numbers (docs/theme.md §3).
 * font-mono alone does not stop 16:00–17:00 from painting backwards.
 */
function LtrIsolate({ className, ...props }: ComponentProps<"bdi">) {
  return (
    <bdi
      dir="ltr"
      className={cn("font-display tabular-nums", className)}
      {...props}
    />
  )
}

export { LtrIsolate }

/**
 * A clock range. Digits and the dash stay in one LTR isolate.
 * A shared h12 marker ("م", "ص", "PM", "AM") stays outside that isolate.
 */
function ClockRangeText({
  label,
  text,
  className,
}: {
  label?: ClockRangeLabel
  /** `formatClockRangeText` output, when the label object was not kept. */
  text?: string
  className?: string
}) {
  const resolved = label ?? (text ? parseClockRangeText(text) : null)
  if (!resolved) return null
  if (resolved.split) {
    const { startDigits, startPeriod, endDigits, endPeriod } = resolved.split
    return (
      <span className={className} dir="ltr">
        <LtrIsolate>{startDigits}</LtrIsolate>
        {` ${startPeriod}–`}
        <LtrIsolate>{endDigits}</LtrIsolate>
        {` ${endPeriod}`}
      </span>
    )
  }
  if (!resolved.period) {
    return <LtrIsolate className={className}>{resolved.digits}</LtrIsolate>
  }
  return (
    <span className={className}>
      <LtrIsolate>{resolved.digits}</LtrIsolate>
      {` ${resolved.period}`}
    </span>
  )
}

export { ClockRangeText }

/** One clock. Digits stay LTR; an h12 marker stays in the surrounding direction. */
function ClockText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { digits, period } = splitDisplayedClock(text);
  if (!period) return <LtrIsolate className={className}>{digits}</LtrIsolate>;
  return (
    <span className={className}>
      <LtrIsolate>{digits}</LtrIsolate>
      {` ${period}`}
    </span>
  );
}

export { ClockText }

const RANGE_PERIOD = /^(.*) (م|ص|AM|PM)$/

function parseClockRangeText(text: string): ClockRangeLabel {
  const match = text.match(RANGE_PERIOD)
  if (match && /^[\d:–]+$/.test(match[1] ?? "")) {
    return { digits: match[1] ?? "", period: match[2] ?? "" }
  }
  const split = text.match(/^(\d{1,2}:\d{2}) (م|ص|AM|PM)–(\d{1,2}:\d{2}) (م|ص|AM|PM)$/)
  if (split) {
    return {
      digits: text,
      period: "",
      split: {
        startDigits: split[1] ?? "",
        startPeriod: split[2] ?? "",
        endDigits: split[3] ?? "",
        endPeriod: split[4] ?? "",
      },
    }
  }
  return { digits: text, period: "" }
}

/** Wrap each digit run so Western numbers stay left-to-right inside Arabic. */
export function IsolatedDigits({ text }: { text: string }) {
  const parts = text.split(/(\d+%?)/)
  return parts.map((part, index) =>
    /^\d+%?$/.test(part) ? (
      <LtrIsolate key={index}>{part}</LtrIsolate>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}
