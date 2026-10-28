import { Fragment, type ComponentProps, type ReactNode } from "react"
import {
  splitDisplayedClock,
  type ClockRangeLabel,
} from "@/lib/format/time"

/**
 * Isolate a Latin run (times, phones, money, yyyy-mm-dd) inside dir="rtl".
 * Direction only. Typography is not its job (docs/ui-rules.md rule 7): digits are
 * tabular from the body, and the one big figure per screen uses <Figure>.
 */
function LtrIsolate({ className, children, ...props }: ComponentProps<"bdi">) {
  return (
    // Digits in times and amounts line up (tabular); other text stays proportional.
    <bdi dir="ltr" className={className ? `tabular-nums ${className}` : "tabular-nums"} {...props}>
      {withLbpUnit(children)}
    </bdi>
  )
}

/** The Arabic pound sign as `formatLbpAmount` writes it. */
const LBP_UNIT_AR = "ل.ل"

/**
 * Arabic letters look bigger than Latin digits at the same size, so "2,000,000 ل.ل" read as a small
 * number beside a big sign. The sign gets its own span (`.lbp-unit` in globals.css: a little smaller,
 * Arabic face) so it sits at the height of the digits. Only plain string children are touched.
 */
function withLbpUnit(children: ReactNode): ReactNode {
  if (typeof children !== "string" || !children.includes(LBP_UNIT_AR)) return children
  return children.split(LBP_UNIT_AR).map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <span className="lbp-unit">{LBP_UNIT_AR}</span> : null}
      {part}
    </Fragment>
  ))
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
