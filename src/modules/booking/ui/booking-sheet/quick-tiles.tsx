import { Clock, Users } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import type { MoreActionKey } from "@/modules/booking/ui/booking-sheet/more-actions";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/**
 * Quick tiles: a two-column grid of large buttons, only on a game that has not ended yet and only for
 * what is available today (the same rule as More actions): extend half an hour, split between players.
 */
export function quickTilesOf(row: UpcomingRowView, available: MoreActionKey[]): Array<"extend" | "split"> {
  const notEnded = row.display.kind === "before" || row.display.kind === "live";
  if (!notEnded) return [];
  return (["extend", "split"] as const).filter((key) => available.includes(key) && !(key === "split" && row.perPlayer.mode === "PER_PLAYER"));
}

export function QuickTiles({
  tiles,
  locale,
  onExtend,
  onSplit,
}: {
  tiles: Array<"extend" | "split">;
  locale: UiLocale;
  onExtend: () => void;
  onSplit: () => void;
}) {
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => {
        const Icon = tile === "extend" ? Clock : Users;
        return (
          <button
            key={tile}
            type="button"
            onClick={tile === "extend" ? onExtend : onSplit}
            className="flex min-h-20 flex-col items-start justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-start type-label outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon aria-hidden className="size-5 text-muted-foreground" />
            {ui(tile === "extend" ? "owner.extend" : "owner.splitPlayers", locale)}
          </button>
        );
      })}
    </div>
  );
}
