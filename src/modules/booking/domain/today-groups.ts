import type { CardDisplay } from "@/modules/booking/domain/card-display";

/**
 * How Today lists the games of a day. Pure: the statuses and times are already on each row.
 * On today: a "now" card (a game running now), then "ended" (played and no-show games, money still owed
 * first, then by time), then "upcoming" by time, then "cancelled" (collapsed by the screen). On any
 * other day: one list by time ("day"), then "cancelled". A group's heading shows only when the day has
 * more than one non-empty group; an empty group is never returned.
 */
export type DayGroupKind = "now" | "ended" | "upcoming" | "day" | "cancelled";

export type DayGroup<T> = {
  kind: DayGroupKind;
  items: T[];
  /** The group is named on the screen. "now" and "day" never are; "cancelled" always is (it is the toggle). */
  showHeading: boolean;
};

type Groupable = { display: CardDisplay; startMs: number };

const OWING = new Set<CardDisplay["kind"]>(["unpaid", "partial", "no_show_unpaid"]);

const byTime = <T extends Groupable>(a: T, b: T) => a.startMs - b.startMs;

/** Unpaid before paid, then by time. */
const unpaidFirst = <T extends Groupable>(a: T, b: T) =>
  Number(OWING.has(b.display.kind)) - Number(OWING.has(a.display.kind)) || byTime(a, b);

export function groupDayGames<T extends Groupable>(rows: readonly T[], isToday: boolean): DayGroup<T>[] {
  const cancelled = rows.filter((row) => row.display.kind === "cancelled").sort(byTime);
  const live = rows.filter((row) => row.display.kind !== "cancelled");
  const groups: Array<{ kind: DayGroupKind; items: T[] }> = isToday
    ? [
        { kind: "now", items: live.filter((row) => row.display.kind === "live").sort(byTime) },
        {
          kind: "ended",
          items: live.filter((row) => row.display.kind !== "live" && row.display.kind !== "before").sort(unpaidFirst),
        },
        { kind: "upcoming", items: live.filter((row) => row.display.kind === "before").sort(byTime) },
        { kind: "cancelled", items: cancelled },
      ]
    : [
        { kind: "day", items: [...live].sort(byTime) },
        { kind: "cancelled", items: cancelled },
      ];
  const shown = groups.filter((group) => group.items.length > 0);
  return shown.map((group) => ({
    ...group,
    showHeading:
      group.kind === "cancelled" || (group.kind !== "now" && group.kind !== "day" && shown.length > 1),
  }));
}
