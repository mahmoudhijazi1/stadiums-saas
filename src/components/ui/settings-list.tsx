import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "cn";

/**
 * The one list markup for More: the hub, the pitch list and the pickers in sheets. A
 * section is a heading (section role, 24px above from the page's gap, 8px below, aligned
 * to the rows' inner start) over one bordered card of rows.
 */
export function SettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h3 className="px-4 type-section">{title}</h3> : null}
      <ul className="overflow-hidden rounded-xl border bg-card">{children}</ul>
    </section>
  );
}

const rowClass =
  "flex min-h-14 w-full items-center justify-between gap-3 bg-card px-4 py-2 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50";

/**
 * A 56px row: label (14px label role, or strong for a name), an optional secondary line and caption
 * line under it, a trailing value (secondary, one line with an ellipsis; callers
 * LTR-isolate numbers) and a 16px muted chevron. With `selected` it is a picker choice and
 * shows a check instead. A link when `href` is given, a button otherwise.
 */
export function SettingsRow({
  label,
  strong = false,
  detail,
  meta,
  value,
  href,
  onClick,
  selected,
  chevron = true,
}: {
  label: ReactNode;
  strong?: boolean;
  /** Secondary line under the label (e.g. the hours summary). */
  detail?: ReactNode;
  /** Caption line under that (e.g. game length and price). */
  meta?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Picker choice: pressed state and a check mark. */
  selected?: boolean;
  chevron?: boolean;
}) {
  const trailing =
    selected ? (
      <Check aria-hidden className="size-4 shrink-0" />
    ) : chevron && (href || onClick) ? (
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
    ) : null;
  const body = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className={strong ? "type-strong" : "type-label"}>{label}</span>
        {detail ? <span className="type-secondary">{detail}</span> : null}
        {meta ? <span className="type-caption">{meta}</span> : null}
      </span>
      {/* Value and chevron are one group pushed to the end, so the value never floats in the middle. */}
      {value !== undefined || trailing ? (
        <span className="ms-auto flex min-w-0 items-center gap-2">
          {value !== undefined ? <span className="min-w-0 truncate type-secondary">{value}</span> : null}
          {trailing}
        </span>
      ) : null}
    </>
  );

  const content = href ? (
    <Link href={href} className={rowClass}>
      {body}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(rowClass, selected && "bg-selected text-selected-ink hover:bg-selected")}
    >
      {body}
    </button>
  ) : (
    <div className={rowClass}>{body}</div>
  );

  return <li className="border-b last:border-b-0">{content}</li>;
}
