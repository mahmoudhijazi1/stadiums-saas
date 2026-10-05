import type { ReactNode } from "react";
import { cn } from "cn";

export type GridColumn = {
  id: string;
  name: string;
  /** Small line under the name, e.g. "Game $35". */
  caption: string;
  /** Open window in minutes from midnight. Time outside it is closed. */
  openStartMin: number;
  openEndMin: number;
  /** BookingBlock / FreeCell children, positioned with `GridGeometry`. */
  items: ReactNode;
};

export type GridGeometry = {
  startMin: number;
  rowMin: number;
  rowPx: number;
};

/** Pixel offset of a minute from midnight inside the grid body. */
export function minuteToPx(minute: number, g: GridGeometry): number {
  return ((minute - g.startMin) / g.rowMin) * g.rowPx;
}

const AXIS_PX = 52;

/**
 * Schedule grid: time axis on the start side, one column per pitch, rows of `rowMin`
 * minutes. Closed time is striped, past time is dimmed, a line marks now. Presentational:
 * every label arrives translated, every time arrives as a node.
 */
export function DayGrid({
  columns,
  geometry,
  endMin,
  nowMin,
  axisLabel,
  nowLabel,
  closedLabel,
}: {
  columns: GridColumn[];
  geometry: GridGeometry;
  endMin: number;
  /** Null when the day is not today. */
  nowMin: number | null;
  axisLabel: (minute: number) => ReactNode;
  nowLabel: string;
  closedLabel: string;
}) {
  const bodyPx = minuteToPx(endMin, geometry);
  const hours: number[] = [];
  for (let m = Math.ceil(geometry.startMin / 60) * 60; m < endMin; m += 60) hours.push(m);
  const nowPx =
    nowMin !== null && nowMin > geometry.startMin && nowMin < endMin
      ? minuteToPx(nowMin, geometry)
      : null;
  const template = { gridTemplateColumns: `${AXIS_PX}px repeat(${columns.length}, minmax(0, 1fr))` };
  const lines = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${geometry.rowPx * (60 / geometry.rowMin)}px)`,
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="grid gap-1" style={template}>
        <span />
        {columns.map((column) => (
          <div key={column.id} className="min-w-0 px-1">
            <p className="truncate text-sm font-semibold">{column.name}</p>
            <p className="truncate text-xs text-muted-foreground">{column.caption}</p>
          </div>
        ))}
      </div>
      <div className="relative grid gap-1" style={template}>
        <div className="relative" style={{ height: bodyPx }}>
          {hours.map((m) => (
            <span
              key={m}
              className="absolute inset-x-0 -translate-y-1/2 text-xs text-muted-foreground"
              style={{ top: minuteToPx(m, geometry) }}
            >
              {axisLabel(m)}
            </span>
          ))}
        </div>
        {columns.map((column) => {
          const openTop = minuteToPx(column.openStartMin, geometry);
          const openBottom = minuteToPx(column.openEndMin, geometry);
          return (
            <div
              key={column.id}
              className="relative overflow-hidden rounded-md bg-surface"
              style={{ height: bodyPx, ...lines }}
            >
              {openTop > 0 ? (
                <ClosedBand top={0} height={openTop} label={closedLabel} />
              ) : null}
              {openBottom < bodyPx ? (
                <ClosedBand top={openBottom} height={bodyPx - openBottom} label={closedLabel} />
              ) : null}
              {column.items}
              {nowPx !== null ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 bg-background/40"
                  style={{ height: nowPx }}
                />
              ) : null}
            </div>
          );
        })}
        {nowPx !== null ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: nowPx }}
          >
            <span className="w-[52px] pe-1 text-end text-[10px] font-semibold leading-none text-foreground">
              {nowLabel}
            </span>
            <span aria-hidden className="h-0.5 flex-1 bg-foreground" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClosedBand({ top, height, label }: { top: number; height: number; label: string }) {
  return (
    <div
      className={cn(
        "fill-stripe pointer-events-none absolute inset-x-0 flex items-start justify-center pt-1",
      )}
      style={{ top, height }}
    >
      <span className="rounded-sm bg-background/80 px-1 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
