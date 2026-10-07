import type { ReactNode } from "react";

/**
 * One column of rows in time order, full width. The time sits on the start side (right in
 * Arabic). Presentational: each row arrives as a node with its time already rendered;
 * a row without a time (the Now divider) spans the full width.
 */
export function DaySheet({
  rows,
  label,
}: {
  rows: { key: string; time?: ReactNode; node: ReactNode; compact?: boolean }[];
  /** Accessible name of the list. */
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {rows.map((row) =>
        row.time === undefined ? (
          <li key={row.key}>{row.node}</li>
        ) : (
          <li key={row.key} className="flex items-start gap-3">
            <span
              className={`w-14 shrink-0 text-sm text-muted-foreground ${row.compact ? "pt-3" : "pt-4"}`}
            >
              {row.time}
            </span>
            <div className="min-w-0 flex-1">{row.node}</div>
          </li>
        ),
      )}
    </ul>
  );
}

/** Divider between past and upcoming on today. */
export function NowDivider({ label }: { label: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 py-1">
      <span className="w-14 shrink-0 text-end text-xs font-semibold text-foreground">{label}</span>
      <span aria-hidden className="h-0.5 flex-1 bg-foreground" />
    </div>
  );
}
