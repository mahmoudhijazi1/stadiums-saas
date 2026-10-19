import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import type { DayGroupKind } from "@/modules/booking/domain/today-groups";
import { cn } from "cn";

/** A running game, pinned above the groups: a raised card with no heading. */
export function NowCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line-strong bg-surface-2 p-1.5">{children}</div>;
}

const HEADINGS: Partial<Record<DayGroupKind, "owner.groupEnded" | "owner.groupUpcoming">> = {
  ended: "owner.groupEnded",
  upcoming: "owner.groupUpcoming",
};

/** "Ended (3)" / "Upcoming (2)": shown only when the day has more than one group. */
export function GroupHeading({ kind, count, locale }: { kind: DayGroupKind; count: number; locale: UiLocale }) {
  const key = HEADINGS[kind];
  if (!key) return null;
  return (
    <h3 className="text-sm font-semibold text-muted-foreground">
      {ui(key, locale)} (<LtrIsolate>{count}</LtrIsolate>)
    </h3>
  );
}

/** "Cancelled (n)": collapsed by default, one tap to list them. */
export function CancelledToggle({
  count,
  expanded,
  onToggle,
  locale,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  locale: UiLocale;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls="cancelled-list"
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-start text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span>
        {ui("owner.groupCancelled", locale)} (<LtrIsolate>{count}</LtrIsolate>)
      </span>
      <ChevronDown aria-hidden className={cn("size-5 shrink-0 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}
