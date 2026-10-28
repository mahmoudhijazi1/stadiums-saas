import { useState, type Ref } from "react";
import { Ban, ChevronDown, Clock, Pencil, Repeat, UserX } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { ActionRow } from "@/modules/booking/ui/booking-sheet/action-row";
import type { CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { SplitSwitchRow } from "@/modules/booking/ui/booking-sheet/split-switch";
import { isPerPlayer, splitAdjustOf, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The rows of "More actions", in their fixed order (destructive last, ui-rules rule 5). */
export type MoreActionKey = "adjust" | "split" | "extend" | "repeat" | "noshow" | "cancel";

/**
 * Which rows show, in order: adjust the amount, split between players, extend half an hour, repeat
 * weekly, no-show, cancel the booking (red, last). A row shows exactly when its action is available
 * now (ui-rules rule 4); nothing is shown disabled.
 */
export function moreActionsOf(
  row: UpcomingRowView,
  may: { mayCancel: boolean; mayNoShow: boolean; mayAdjust: boolean },
): MoreActionKey[] {
  const splitAdjust = splitAdjustOf(row, may.mayAdjust);
  const shown: Record<MoreActionKey, boolean> = {
    adjust: may.mayAdjust && row.canAdjust,
    split: splitAdjust && (isPerPlayer(row) || row.perPlayer.canSplit),
    extend: row.extend !== null && row.extend.allowed,
    repeat: row.repeatWeekly,
    noshow: may.mayNoShow && row.showNoShow,
    cancel: may.mayCancel && row.showCancel,
  };
  return (["adjust", "split", "extend", "repeat", "noshow", "cancel"] as const).filter((key) => shown[key]);
}

/** "More actions" (AR: إجراءات أخرى): a disclosure over the ordered list. */
export function MoreActions({
  row,
  locale,
  mayCancel,
  mayNoShow,
  mayAdjust,
  cancelRef,
  onCancelBooking,
  onNoShow,
  onAdjust,
  onExtend,
  onRepeat,
  collectActions,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  mayCollect?: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  cancelRef: Ref<HTMLButtonElement>;
  onCancelBooking: () => void;
  onNoShow: () => void;
  onAdjust: () => void;
  onExtend: () => void;
  onRepeat: () => void;
  collectActions: CollectActions;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const rows = moreActionsOf(row, { mayCancel, mayNoShow, mayAdjust });
  if (rows.length === 0) return null;

  const render = (key: MoreActionKey) => {
    switch (key) {
      case "adjust":
        return (
          <ActionRow key={key} icon={Pencil} onClick={onAdjust}>
            {ui("owner.adjustDue", locale)}
          </ActionRow>
        );
      case "split":
        return (
          <SplitSwitchRow
            key={key}
            view={row.perPlayer}
            locale={locale}
            submitSwitchToPerPlayer={collectActions.submitSwitchToPerPlayer}
            submitSwitchToWhole={collectActions.submitSwitchToWhole}
          />
        );
      case "extend":
        return (
          <ActionRow key={key} icon={Clock} onClick={onExtend}>
            {ui("owner.extend", locale)}
          </ActionRow>
        );
      case "repeat":
        return (
          <ActionRow key={key} icon={Repeat} onClick={onRepeat}>
            {ui("owner.repeatWeekly", locale)}
          </ActionRow>
        );
      case "noshow":
        return (
          <ActionRow key={key} icon={UserX} onClick={onNoShow}>
            {ui("owner.noShow", locale)}
          </ActionRow>
        );
      case "cancel":
        return (
          <ActionRow key={key} icon={Ban} onClick={onCancelBooking} buttonRef={cancelRef} destructive>
            {ui("owner.cancel", locale)}
          </ActionRow>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {ui("owner.moreActions", locale)}
        <ChevronDown aria-hidden className={cn("size-5 shrink-0 transition-transform", moreOpen && "rotate-180")} />
      </button>
      {moreOpen ? <div className="flex flex-col gap-1">{rows.map(render)}</div> : null}
    </div>
  );
}
