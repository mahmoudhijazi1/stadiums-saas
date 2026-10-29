"use client";

import { useEffect, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { cn } from "cn";
import { BottomSheet, BottomSheetBody, BottomSheetContent, BottomSheetStage } from "@/components/ui/bottom-sheet";
import type { OutcomeNotify } from "@/modules/booking/domain/outcome-notify";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import { InterestPanel, NotifyPersonRow } from "@/modules/booking/ui/notify-list";
import { AdjustDueForm, CancelDecisionForm, NoShowDecisionForm, type FeeActions } from "@/modules/booking/ui/fee-forms";
import { ExtendForm, type ExtendActions } from "@/modules/booking/ui/extend-form";
import { WeeklyConfirm } from "@/modules/booking/ui/weekly-confirm";
import { SeriesManage, type SeriesActions } from "@/modules/booking/ui/series-manage";
import type { ItemsActions } from "@/modules/booking/ui/booking-items";
import { gameMoneyOf, type CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { MoreActionsList } from "@/modules/booking/ui/booking-sheet/more-actions";
import { OtherAmountForm } from "@/modules/booking/ui/booking-sheet/other-amount";
import { ShopTabs } from "@/modules/booking/ui/booking-sheet/shop-tabs";
import { SplitSwitchRow } from "@/modules/booking/ui/booking-sheet/split-switch";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import { collectMode } from "@/modules/booking/ui/booking-sheet/row-view";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { SheetHeader, type SheetStep } from "@/modules/booking/ui/booking-sheet/sheet-header";
import { UpcomingRowActions } from "@/modules/booking/ui/booking-sheet/sheet-details";

/**
 * The game sheet: header, then either the notify/interest view or the two stages: the main view, and
 * one step at a time in place of it (other amount, items, More actions, the shares of a split game,
 * split, cancel, no-show, adjust, extend, repeat weekly, series) with a back arrow, never by growing the
 * main view. Actions come in as five typed groups; the page passes the real Server Actions.
 */
export function BookingSheet({
  sheetRow,
  open,
  onClose,
  locale,
  interestOpen,
  saved,
  sheetStep,
  moveStep,
  confirmRef,
  cancelRef,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  date,
  lbpPerUsd,
  shop,
  collectActions,
  extendActions,
  itemsActions,
  seriesActions,
  feeActions,
}: {
  sheetRow: UpcomingRowView | null;
  /** A booking is open (the sheet is shown). */
  open: boolean;
  onClose: () => void;
  locale: UiLocale;
  interestOpen: boolean;
  saved?: OutcomeNotify | null;
  sheetStep: SheetStep;
  moveStep: (next: SheetStep) => void;
  confirmRef: RefObject<HTMLButtonElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  date?: string;
  lbpPerUsd: string | null;
  shop: { products: SellItem[]; maySell: boolean };
  collectActions: CollectActions;
  extendActions: ExtendActions;
  itemsActions: ItemsActions;
  seriesActions: SeriesActions;
  feeActions: FeeActions;
}) {
  // The clock for the status chip ("in 25 min"), read once when the sheet renders on the client.
  const [nowMs] = useState(() => Date.now());
  // After a collection the game's money changes: the "Other amount or currency" step goes back to the main view.
  const moneyKey = sheetRow ? `${sheetRow.id}:${gameMoneyOf(sheetRow).remaining}` : "";
  const [seenMoney, setSeenMoney] = useState(moneyKey);
  useEffect(() => {
    if (seenMoney === moneyKey) return;
    setSeenMoney(moneyKey);
    if (sheetStep === "other") moveStep("details");
  }, [moneyKey, seenMoney, sheetStep, moveStep]);
  const back = () => moveStep("details");
  const router = useRouter();
  return (
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {sheetRow ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)} showCloseButton={false}>
            <SheetHeader sheetRow={sheetRow} sheetStep={sheetStep} locale={locale} onBack={back} nowMs={nowMs} />
            {interestOpen ? (
              <BottomSheetBody className="flex flex-col gap-4 pb-4">
                {saved?.bookingId === sheetRow.id ? (
                  <NotifyPersonRow
                    person={{
                      personId: saved.personId,
                      name: saved.name,
                      phone: saved.phone,
                      whatsAppHref: saved.whatsAppHref,
                      message: saved.message,
                      statusLabel: saved.statusLabel,
                    }}
                    locale={locale}
                    href={`/owner/people/${saved.personId}`}
                  />
                ) : null}
                {sheetRow.interested.length > 0 &&
                (saved?.bookingId !== sheetRow.id ||
                  saved.kind === "cancelled") ? (
                  <InterestPanel
                    people={sheetRow.interested}
                    locale={locale}
                    timeRange={sheetRow.timeRange}
                    pitchName={sheetRow.pitchName}
                  />
                ) : null}
              </BottomSheetBody>
            ) : (
              <>
            <BottomSheetStage
              stage={sheetStep !== "details" ? "confirm" : "details"}
              active={open}
            >
              <BottomSheetBody
                className={cn(
                  "flex flex-col gap-4 pb-4 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  sheetStep !== "details" &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={sheetStep !== "details" ? true : undefined}
              >
                <UpcomingRowActions collectActions={collectActions} itemsActions={itemsActions}
                  key={`${sheetRow.id}:${sheetRow.remainingUsd}`}
                  row={sheetRow}
                  lbpPerUsd={lbpPerUsd}
                  locale={locale}
                  mayCollect={mayCollect}
                  mayCancel={mayCancel}
                  mayNoShow={mayNoShow}
                  mayAdjust={mayAdjust}
                  shop={shop}
                  onExtend={() => moveStep("extend")}
                  onSeries={() => moveStep("series")}
                  onOther={() => moveStep("other")}
                  onItems={() => moveStep("items")}
                  onMore={() => moveStep("more")}
                  onShares={() => moveStep("shares")}
                  onSplit={() => moveStep("split")}
                  onItemsDone={() => router.refresh()}
                />
              </BottomSheetBody>
              <BottomSheetBody
                className={cn(
                  "flex flex-col gap-3 pb-4 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  sheetStep === "details" &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={sheetStep === "details" ? true : undefined}
              >
                {sheetStep === "other" ? (
                  <OtherAmountForm
                    id={`game-${sheetRow.id}`}
                    currency={gameMoneyOf(sheetRow).currency}
                    remaining={gameMoneyOf(sheetRow).remaining}
                    lbpPerUsd={lbpPerUsd}
                    locale={locale}
                    submit={{ kind: "action", action: collectActions.submitCollectPayment, hidden: { bookingId: sheetRow.id } }}
                  />
                ) : null}
                {sheetStep === "items" ? (
                  <ShopTabs
                    row={sheetRow}
                    shop={shop}
                    mayAdjust={mayAdjust}
                    mayCollect={mayCollect}
                    lbpPerUsd={lbpPerUsd}
                    locale={locale}
                    itemsActions={itemsActions}
                  />
                ) : null}
                {sheetStep === "more" ? (
                  <MoreActionsList
                    row={sheetRow}
                    locale={locale}
                    mayCancel={mayCancel}
                    mayNoShow={mayNoShow}
                    mayAdjust={mayAdjust}
                    cancelRef={cancelRef}
                    onCancelBooking={() => moveStep("cancel")}
                    onNoShow={() => moveStep("noshow")}
                    onAdjust={() => moveStep("adjust")}
                    onExtend={() => moveStep("extend")}
                    onRepeat={() => moveStep("repeat")}
                    collectActions={collectActions}
                  />
                ) : null}
                {sheetStep === "shares" ? (
                  <PerPlayerCollect
                    view={sheetRow.perPlayer}
                    mayCollect={mayCollect}
                    advanceNeeded={collectMode(sheetRow) === "advance"}
                    lbpPerUsd={lbpPerUsd}
                    locale={locale}
                    submitCollectAllRemaining={collectActions.submitCollectAllRemaining}
                    submitCollectSlot={collectActions.submitCollectSlot}
                    submitConsiderSharePaid={collectActions.submitConsiderSharePaid}
                  />
                ) : null}
                {sheetStep === "split" ? (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <SplitSwitchRow
                      view={sheetRow.perPlayer}
                      locale={locale}
                      initialAsking
                      submitSwitchToPerPlayer={collectActions.submitSwitchToPerPlayer}
                      submitSwitchToWhole={collectActions.submitSwitchToWhole}
                    />
                  </div>
                ) : null}
                {sheetStep === "cancel" ? (
                  <CancelDecisionForm submitCancelBooking={feeActions.submitCancelBooking}
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    mayAdjust={mayAdjust}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "noshow" ? (
                  <NoShowDecisionForm submitRecordNoShow={feeActions.submitRecordNoShow}
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    mayAdjust={mayAdjust}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "extend" && sheetRow.extend ? (
                  <ExtendForm {...extendActions}
                    bookingId={sheetRow.id}
                    offer={sheetRow.extend}
                    locale={locale}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "series" && sheetRow.series ? (
                  <SeriesManage {...seriesActions}
                    seriesId={sheetRow.series.seriesId}
                    locale={locale}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "repeat" ? (
                  <WeeklyConfirm previewSeriesAction={seriesActions.previewSeriesAction} submitSeriesSave={seriesActions.submitSeriesSave}
                    source={{ kind: "booking", bookingId: sheetRow.id }}
                    locale={locale}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "adjust" ? (
                  <AdjustDueForm submitAdjustBookingDue={feeActions.submitAdjustBookingDue}
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    confirmRef={confirmRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
              </BottomSheetBody>
            </BottomSheetStage>
              </>
            )}
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
  );
}
