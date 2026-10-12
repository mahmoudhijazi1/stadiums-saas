import { Button } from "@/components/ui/button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

export type WeeklyItem = {
  seriesId: string;
  personName: string;
  /** "Every Tue 8:00 PM". */
  when: string;
  /** Null when the stadium has one pitch. */
  pitchName: string | null;
  left: number;
};

/**
 * One weekly booking: the whole card is a button that opens the series sheet (a stretched button,
 * so Renew can sit on top of it as its own button and a tap on Renew never reaches the card).
 */
export function WeeklyCard({
  item,
  mayRenew,
  locale,
  onOpen,
  onRenew,
}: {
  item: WeeklyItem;
  mayRenew: boolean;
  locale: UiLocale;
  onOpen: (item: WeeklyItem) => void;
  onRenew: (item: WeeklyItem) => void;
}) {
  return (
    <li className="relative flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/60">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 flex-col text-start outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring/50"
      >
        <span className="type-strong">
          <bdi>{item.personName}</bdi>
        </span>
        <span className="type-secondary">
          <LtrIsolate>{item.when}</LtrIsolate>
          {item.pitchName ? <span> · {item.pitchName}</span> : null}
        </span>
        <span className="type-caption">{ui("owner.weeklyLeft", locale).replace("{n}", String(item.left))}</span>
      </button>
      {mayRenew ? (
        <Button type="button" variant="outline" className="relative z-10 shrink-0" onClick={() => onRenew(item)}>
          {ui("owner.weeklyRenew", locale)}
        </Button>
      ) : null}
    </li>
  );
}
