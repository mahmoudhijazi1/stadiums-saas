import type { Ref } from "react";
import { Ban, ChevronRight, Clock, Ellipsis, Pencil, Repeat, UserX } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
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

/**
 * "More actions" (AR: إجراءات أخرى) on the game sheet: ONE row that opens the list as its own step.
 * Not shown when no action is available.
 */
export function MoreActionsRow({ count, locale, onOpen }: { count: number; locale: UiLocale; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 text-start type-label outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Ellipsis aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{ui("owner.moreActions", locale)}</span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" />
    </button>
  );
}

/**
 * The More actions step: the ordered list (icon + label, 56px rows), each row only when its action is
 * available today (rule 4); cancel the booking in red, in its own group, last (rule 5).
 */
export function MoreActionsList({
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
  const rows = moreActionsOf(row, { mayCancel, mayNoShow, mayAdjust });

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

  const main = rows.filter((key) => key !== "cancel");
  return (
    <div className="flex flex-col gap-3">
      {main.length > 0 ? <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">{main.map(render)}</div> : null}
      {rows.includes("cancel") ? (
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">{render("cancel")}</div>
      ) : null}
    </div>
  );
}
