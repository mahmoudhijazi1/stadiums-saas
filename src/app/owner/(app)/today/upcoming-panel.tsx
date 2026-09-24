"use client";

import { useLayoutEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import type { UiLocale } from "@/lib/locale";
import {
  collectUsdLabel,
  ui,
} from "@/lib/ui-copy";
import {
  submitCancelBooking,
  submitCollectPayment,
  submitRecordNoShow,
} from "./actions";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetStage,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import type { CardDisplay } from "@/modules/booking/domain/card-display";
import type { UpcomingStatus } from "@/modules/booking/domain/home-inbox";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Radio,
} from "lucide-react";

export type UpcomingRowView = {
  id: string;
  pitchName: string;
  timeRange: string;
  dateLabel: string;
  requesterName: string;
  requesterPhone: string;
  remainingUsd: string;
  priceUsd: string;
  status: UpcomingStatus;
  display: CardDisplay;
  displayAmountUsd: string;
  confirmWhatsAppHref: string | null;
  showCancel: boolean;
  showNoShow: boolean;
};

function CardTrail({
  display,
  amountUsd,
  locale,
}: {
  display: CardDisplay;
  amountUsd: string;
  locale: UiLocale;
}) {
  if (display.kind === "no_show_unpaid") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-alert">
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        <span>{ui("owner.noShow", locale)}</span>
        <span aria-hidden>·</span>
        <LtrIsolate>${amountUsd}</LtrIsolate>
        <span>{ui("owner.dueShort", locale)}</span>
      </span>
    );
  }
  if (display.kind === "no_show_paid") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <span>{ui("owner.noShow", locale)}</span>
        <span aria-hidden>·</span>
        <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
        <span>{ui("owner.paid", locale)}</span>
      </span>
    );
  }
  if (display.kind === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <span>{ui("owner.cancelledShort", locale)}</span>
      </span>
    );
  }
  if (display.kind === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
        <Radio aria-hidden className="size-4 shrink-0" />
        <span>{ui("owner.live", locale)}</span>
        <span aria-hidden>·</span>
        <LtrIsolate>{display.minutesLeft}</LtrIsolate>
        <span>{ui("owner.minLeft", locale)}</span>
      </span>
    );
  }
  if (display.kind === "unpaid" || display.kind === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-alert">
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        <LtrIsolate>${amountUsd}</LtrIsolate>
        <span>
          {ui(
            display.kind === "partial" ? "owner.leftShort" : "owner.dueShort",
            locale,
          )}
        </span>
      </span>
    );
  }
  if (display.kind === "paid") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
        <CircleCheck aria-hidden className="size-4 shrink-0" />
        <span>{ui("owner.paid", locale)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <CircleDollarSign aria-hidden className="size-4 shrink-0" />
      <LtrIsolate>${amountUsd}</LtrIsolate>
    </span>
  );
}

function DueRemainingFigures({
  dueUsd,
  remainingUsd,
  locale,
}: {
  dueUsd: string;
  remainingUsd: string;
  locale: UiLocale;
}) {
  const owed = remainingUsd !== "0.00";
  const same = dueUsd === remainingUsd;

  if (same) {
    return (
      <div
        className={cn(
          "rounded-lg px-3 py-3 text-start",
          owed ? "bg-success/15" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "text-xs",
            owed ? "text-success" : "text-muted-foreground",
          )}
        >
          {ui("owner.remaining", locale)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-2xl font-semibold",
            owed ? "text-success" : "text-muted-foreground",
          )}
        >
          <LtrIsolate>${remainingUsd}</LtrIsolate>
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-muted px-3 py-2 text-start">
        <p className="text-xs text-muted-foreground">{ui("owner.due", locale)}</p>
        <p className="mt-0.5 text-base font-semibold text-foreground">
          <LtrIsolate>${dueUsd}</LtrIsolate>
        </p>
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-start",
          owed ? "bg-success/15" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "text-xs",
            owed ? "text-success" : "text-muted-foreground",
          )}
        >
          {ui("owner.remaining", locale)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-base font-semibold",
            owed ? "text-success" : "text-muted-foreground",
          )}
        >
          <LtrIsolate>${remainingUsd}</LtrIsolate>
        </p>
      </div>
    </div>
  );
}

export function UpcomingPanel({
  toCollect,
  toCollectHasMore,
  games,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  highlight,
}: {
  toCollect: UpcomingRowView[];
  toCollectHasMore: boolean;
  games: UpcomingRowView[];
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  highlight?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [heldRow, setHeldRow] = useState<UpcomingRowView | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const openRow =
    [...toCollect, ...games].find((row) => row.id === openId) ?? null;
  const sheetRow = openRow ?? heldRow;
  const confirmSubmitRef = useRef<HTMLButtonElement>(null);
  const cancelBookingRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<"confirm" | "cancel" | null>(null);

  function closeSheet() {
    setOpenId(null);
  }

  function setCancelStep(next: boolean) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    pendingFocusRef.current = next ? "confirm" : "cancel";
    setConfirmCancel(next);
  }

  useLayoutEffect(() => {
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target === "confirm") confirmSubmitRef.current?.focus();
    if (target === "cancel") cancelBookingRef.current?.focus();
  }, [confirmCancel]);

  function openRowSheet(id: string) {
    const row =
      [...toCollect, ...games].find((item) => item.id === id) ?? null;
    if (!row) return;
    setConfirmCancel(false);
    setHeldRow(row);
    setOpenId(id);
  }

  return (
    <div className="flex flex-col gap-3">
      {toCollect.length > 0 ? (
        <>
          <h3 className="text-sm font-medium text-muted-foreground">
            {ui("owner.toCollect", locale)}
          </h3>
          <UpcomingRows
            rows={toCollect}
            showDate
            openId={openId}
            onOpen={openRowSheet}
            locale={locale}
            highlight={highlight}
            mayCollect={mayCollect}
            rowKeyPrefix="collect"
          />
          {toCollectHasMore ? (
            <Link
              href="/owner/money"
              className="inline-flex min-h-11 items-center self-start text-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ui("owner.seeAll", locale)}
            </Link>
          ) : null}
        </>
      ) : null}

      {games.length > 0 ? (
        <UpcomingRows
          rows={games}
          showDate={false}
          openId={openId}
          onOpen={openRowSheet}
          locale={locale}
          highlight={highlight}
          mayCollect={mayCollect}
          rowKeyPrefix="day"
        />
      ) : (
        <EmptyState
          title={ui("empty.confirmed", locale)}
          next={ui("empty.confirmedNext", locale)}
        />
      )}

      <BottomSheet
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        {sheetRow ? (
          <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
            <BottomSheetHeader>
              <BottomSheetTitle
                aria-label={
                  confirmCancel
                    ? ui("owner.cancel", locale)
                    : sheetRow.timeRange
                }
              >
                <span className="grid">
                  <span
                    className={cn(
                      "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                      confirmCancel ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden={!confirmCancel}
                  >
                    {ui("owner.cancel", locale)}
                  </span>
                  <span
                    className={cn(
                      "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                      confirmCancel ? "opacity-0" : "opacity-100",
                    )}
                    aria-hidden={confirmCancel}
                  >
                    <LtrIsolate className="text-xl font-bold leading-none">
                      {sheetRow.timeRange}
                    </LtrIsolate>
                  </span>
                </span>
              </BottomSheetTitle>
              <BottomSheetDescription>
                {sheetRow.pitchName}
                {toCollect.some((item) => item.id === sheetRow.id)
                  ? ` · ${sheetRow.dateLabel}`
                  : null}
                {" · "}
                {sheetRow.requesterName}
              </BottomSheetDescription>
            </BottomSheetHeader>
            <div className="flex flex-col gap-2 px-4 pt-2">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Phone aria-hidden className="size-3.5 shrink-0" />
                <LtrIsolate>{sheetRow.requesterPhone}</LtrIsolate>
              </p>
              {sheetRow.confirmWhatsAppHref ? (
                <Button variant="outline" className="w-full" asChild>
                  <a
                    href={sheetRow.confirmWhatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    {ui("owner.notifyWhatsApp", locale)}
                  </a>
                </Button>
              ) : null}
            </div>
            <BottomSheetStage
              stage={confirmCancel ? "confirm" : "details"}
              active={openId !== null}
            >
              <BottomSheetBody
                className={cn(
                  "flex flex-col gap-4 pb-4 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  confirmCancel &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={confirmCancel ? true : undefined}
              >
                <UpcomingRowActions
                  key={`${sheetRow.id}:${sheetRow.remainingUsd}`}
                  row={sheetRow}
                  locale={locale}
                  mayCollect={mayCollect}
                  mayCancel={mayCancel}
                  mayNoShow={mayNoShow}
                  cancelRef={cancelBookingRef}
                  onCancelBooking={() => setCancelStep(true)}
                />
              </BottomSheetBody>
              <BottomSheetBody
                className={cn(
                  "flex flex-none flex-col gap-3 overflow-hidden pb-4 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  !confirmCancel &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={!confirmCancel ? true : undefined}
              >
                <p className="text-sm text-muted-foreground">
                  {ui("owner.cancelHint", locale)}
                </p>
                <form action={submitCancelBooking}>
                  <input type="hidden" name="bookingId" value={sheetRow.id} />
                  <SubmitButton
                    ref={confirmSubmitRef}
                    variant="destructive"
                    className="w-full"
                  >
                    {ui("owner.cancelConfirm", locale)}
                  </SubmitButton>
                </form>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setCancelStep(false)}
                >
                  {ui("owner.cancelBack", locale)}
                </Button>
              </BottomSheetBody>
            </BottomSheetStage>
          </BottomSheetContent>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function UpcomingRows({
  rows,
  showDate,
  openId,
  onOpen,
  locale,
  highlight,
  mayCollect,
  rowKeyPrefix,
}: {
  rows: UpcomingRowView[];
  showDate: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
  locale: UiLocale;
  highlight?: string;
  mayCollect: boolean;
  rowKeyPrefix: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const open = openId === row.id;
        const highlighted = highlight === row.id;
        return (
          <li key={`${rowKeyPrefix}-${row.id}`} id={`${rowKeyPrefix}-${row.id}`}>
            <Card
              className={cn(
                "gap-0 overflow-hidden py-0 shadow-none",
                (open || highlighted) && "ring-2 ring-inset ring-action-ink",
                highlighted && !open && "bg-action-ink/10",
              )}
            >
              <div className="flex w-full items-center gap-3">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={() => onOpen(row.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-start",
                    "cursor-pointer bg-transparent outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Clock
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <LtrIsolate
                        className={cn(
                          "text-lg font-semibold leading-none whitespace-nowrap",
                          row.display.kind === "cancelled" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {row.timeRange}
                      </LtrIsolate>
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin aria-hidden className="size-4 shrink-0" />
                        {row.pitchName}
                      </span>
                      {showDate ? <span>{row.dateLabel}</span> : null}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {row.requesterName}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 self-center">
                    <CardTrail
                      display={row.display}
                      amountUsd={row.displayAmountUsd}
                      locale={locale}
                    />
                    {mayCollect &&
                    (row.display.kind === "unpaid" ||
                      row.display.kind === "partial" ||
                      row.display.kind === "no_show_unpaid") ? null : (
                      <ChevronRight
                        aria-hidden
                        className="size-5 text-muted-foreground rtl:rotate-180"
                      />
                    )}
                  </span>
                  <span className="sr-only">{ui("owner.openBooking", locale)}</span>
                </button>
                {mayCollect &&
                (row.display.kind === "unpaid" ||
                  row.display.kind === "partial" ||
                  row.display.kind === "no_show_unpaid") ? (
                  <Button
                    type="button"
                    size="sm"
                    className="my-3 me-4 min-h-11 shrink-0"
                    onClick={() => onOpen(row.id)}
                  >
                    {ui("owner.collect", locale)}
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function UpcomingRowActions({
  row,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  cancelRef,
  onCancelBooking,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  cancelRef: Ref<HTMLButtonElement>;
  onCancelBooking: () => void;
}) {
  const [mixedOpen, setMixedOpen] = useState(false);
  const canCollect =
    mayCollect &&
    row.display.kind !== "cancelled" &&
    row.display.kind !== "no_show_paid" &&
    row.status !== "paid";

  return (
    <>
      <div className="flex flex-col gap-4">
        <h4 className="text-xs font-medium text-muted-foreground">
          {ui("owner.moneyGroup", locale)}
        </h4>
        <DueRemainingFigures
          dueUsd={row.priceUsd}
          remainingUsd={row.remainingUsd}
          locale={locale}
        />
        {canCollect && !mixedOpen ? (
          <form action={submitCollectPayment}>
            <input type="hidden" name="bookingId" value={row.id} />
            <input type="hidden" name="usdAmount" value={row.remainingUsd} />
            <SubmitButton className="w-full">
              {collectUsdLabel(row.remainingUsd, locale)}
            </SubmitButton>
          </form>
        ) : null}
        {canCollect ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              aria-expanded={mixedOpen}
              onClick={() => setMixedOpen((open) => !open)}
            >
              {mixedOpen
                ? ui("owner.hideCollectMixed", locale)
                : ui("owner.collectMixed", locale)}
            </Button>
            {mixedOpen ? (
              <form action={submitCollectPayment} className="flex flex-col gap-4">
                <input type="hidden" name="bookingId" value={row.id} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`usd-${row.id}`}>
                    {ui("owner.usdRemaining", locale)}
                  </Label>
                  <Input
                    id={`usd-${row.id}`}
                    type="text"
                    name="usdAmount"
                    inputMode="decimal"
                    defaultValue={row.remainingUsd}
                    placeholder={row.remainingUsd}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`lbp-${row.id}`}>
                    {ui("owner.lbp", locale)}
                  </Label>
                  <Input
                    id={`lbp-${row.id}`}
                    type="text"
                    name="lbpAmount"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <SubmitButton className="w-full">
                  {ui("owner.moneyGroup", locale)}
                </SubmitButton>
              </form>
            ) : null}
          </>
        ) : null}
        {mayNoShow && row.showNoShow ? (
          <form action={submitRecordNoShow}>
            <input type="hidden" name="bookingId" value={row.id} />
            <SubmitButton variant="outline" className="w-full">
              {ui("owner.noShow", locale)}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {mayCancel && row.showCancel ? (
        <Button
          ref={cancelRef}
          type="button"
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onCancelBooking}
        >
          {ui("owner.cancel", locale)}
        </Button>
      ) : null}
    </>
  );
}
