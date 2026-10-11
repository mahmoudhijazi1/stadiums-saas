import { useState, type Ref } from "react";
import { Ban, ChevronDown, Pencil, Repeat, UserX } from "lucide-react";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import { ActionRow } from "@/modules/booking/ui/booking-sheet/action-row";
import { ExtendEntry } from "@/modules/booking/ui/booking-sheet/extend-entry";
import type { CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { isPerPlayer, splitAdjustOf, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";

/** The "More actions" section: extend, repeat weekly, adjust due, the split switch, no-show, cancel. */
export function MoreActions({
  row,
  locale,
  mayCollect,
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
  mayCollect: boolean;
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
  const { submitCollectAllRemaining, submitCollectSlot, submitSwitchToPerPlayer, submitSwitchToWhole } = collectActions;
  const perPlayer = isPerPlayer(row);
  const splitAdjust = splitAdjustOf(row, mayAdjust);
  const showSplit = splitAdjust && (perPlayer || row.perPlayer.canSplit);
  const showAdjust = mayAdjust && row.canAdjust;
  const showNoShow = mayNoShow && row.showNoShow;
  const showCancel = mayCancel && row.showCancel;
  const showExtend = row.extend !== null;
  const showRepeat = row.repeatWeekly;
  const hasMore = showAdjust || showExtend || showRepeat || showSplit || showNoShow || showCancel;

  if (!hasMore) return null;
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
          {moreOpen ? (
            <div className="flex flex-col gap-3">
              <ExtendEntry row={row} locale={locale} onExtend={onExtend} />
              {showRepeat ? (
                <ActionRow icon={Repeat} onClick={onRepeat}>
                  {ui("owner.repeatWeekly", locale)}
                </ActionRow>
              ) : null}
              {showAdjust ? (
                <ActionRow icon={Pencil} onClick={onAdjust}>
                  {ui("owner.adjustDue", locale)}
                </ActionRow>
              ) : null}
              {showSplit ? (
                <PerPlayerCollect submitCollectAllRemaining={submitCollectAllRemaining} submitCollectSlot={submitCollectSlot} submitSwitchToPerPlayer={submitSwitchToPerPlayer} submitSwitchToWhole={submitSwitchToWhole} view={row.perPlayer} part="mode" mayCollect={mayCollect} mayAdjust={splitAdjust} locale={locale} />
              ) : null}
              {showNoShow ? (
                <ActionRow icon={UserX} onClick={onNoShow}>
                  {ui("owner.noShow", locale)}
                </ActionRow>
              ) : null}
              {showCancel ? (
                <ActionRow icon={Ban} onClick={onCancelBooking} buttonRef={cancelRef} destructive>
                  {ui("owner.cancel", locale)}
                </ActionRow>
              ) : null}
            </div>
          ) : null}
        </div>
  );
}
