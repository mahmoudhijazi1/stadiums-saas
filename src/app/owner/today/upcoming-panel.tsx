"use client";

import { useLayoutEffect, useRef, useState, type Ref } from "react";
import type { UiLocale } from "@/lib/locale";
import {
  collectUsdLabel,
  overdueCount,
  ui,
} from "@/lib/ui-copy";
import {
  submitCancelBooking,
  submitCollectPayment,
  submitRecordNoShow,
} from "./actions";
import { Badge } from "@/components/ui/badge";
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
import type { UpcomingStatus } from "@/modules/booking/domain/home-inbox";
import { ChevronRight, CircleCheck, Clock, MapPin, MessageCircle, Phone } from "lucide-react";

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
  confirmWhatsAppHref: string | null;
  showCancel: boolean;
  showNoShow: boolean;
};

function keepTenantQuery(tenantSlug: string) {
  return <input type="hidden" name="tenant" value={tenantSlug} />;
}

function StatusBadge({
  status,
  locale,
}: {
  status: UpcomingStatus;
  locale: UiLocale;
}) {
  if (status === "due") {
    return <Badge variant="outline">{ui("owner.due", locale)}</Badge>;
  }
  if (status === "paid") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        <CircleCheck aria-hidden className="size-3 text-primary" />
        {ui("owner.paid", locale)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {ui("owner.upcomingTag", locale)}
    </Badge>
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
          owed ? "bg-primary/15" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "text-xs",
            owed ? "text-primary" : "text-muted-foreground",
          )}
        >
          {ui("owner.remaining", locale)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-2xl font-semibold",
            owed ? "text-primary" : "text-muted-foreground",
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
          owed ? "bg-primary/15" : "bg-muted",
        )}
      >
        <p
          className={cn(
            "text-xs",
            owed ? "text-primary" : "text-muted-foreground",
          )}
        >
          {ui("owner.remaining", locale)}
        </p>
        <p
          className={cn(
            "mt-0.5 text-base font-semibold",
            owed ? "text-primary" : "text-muted-foreground",
          )}
        >
          <LtrIsolate>${remainingUsd}</LtrIsolate>
        </p>
      </div>
    </div>
  );
}

export function UpcomingPanel({
  overdue,
  today,
  later,
  tenantSlug,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  highlight,
}: {
  overdue: UpcomingRowView[];
  today: UpcomingRowView[];
  later: UpcomingRowView[];
  tenantSlug: string;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  highlight?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [heldRow, setHeldRow] = useState<UpcomingRowView | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showComing, setShowComing] = useState(
    () => Boolean(highlight && later.some((row) => row.id === highlight)),
  );
  const openRow =
    [...overdue, ...today, ...later].find((row) => row.id === openId) ?? null;
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
      [...overdue, ...today, ...later].find((item) => item.id === id) ?? null;
    if (!row) return;
    setConfirmCancel(false);
    setHeldRow(row);
    setOpenId(id);
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {ui("owner.upcoming", locale)}
      </h3>

      {overdue.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-muted-foreground">
            {overdueCount(overdue.length, locale)}
          </h4>
          <UpcomingRows
            rows={overdue}
            showDate
            openId={openId}
            onOpen={openRowSheet}
            locale={locale}
            highlight={highlight}
          />
        </>
      ) : null}

      {today.length > 0 ? (
        <UpcomingRows
          rows={today}
          showDate={false}
          openId={openId}
          onOpen={openRowSheet}
          locale={locale}
          highlight={highlight}
        />
      ) : overdue.length === 0 ? (
        <EmptyState
          title={ui("empty.confirmed", locale)}
          next={ui("empty.confirmedNext", locale)}
        />
      ) : null}

      {later.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() => setShowComing((open) => !open)}
          >
            {showComing
              ? ui("owner.hideComingDays", locale)
              : ui("owner.showComingDays", locale)}
          </Button>
          {showComing ? (
            <UpcomingRows
              rows={later}
              showDate
              openId={openId}
              onOpen={openRowSheet}
              locale={locale}
              highlight={highlight}
            />
          ) : null}
        </>
      ) : null}

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
                {showDateFor(sheetRow, overdue, later)
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
                  tenantSlug={tenantSlug}
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
                  {keepTenantQuery(tenantSlug)}
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

function showDateFor(
  row: UpcomingRowView,
  overdue: UpcomingRowView[],
  later: UpcomingRowView[],
): boolean {
  return (
    overdue.some((item) => item.id === row.id) ||
    later.some((item) => item.id === row.id)
  );
}

function UpcomingRows({
  rows,
  showDate,
  openId,
  onOpen,
  locale,
  highlight,
}: {
  rows: UpcomingRowView[];
  showDate: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
  locale: UiLocale;
  highlight?: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const open = openId === row.id;
        const highlighted = highlight === row.id;
        return (
          <li key={row.id} id={`booking-${row.id}`}>
            <Card
              className={cn(
                "gap-0 py-0",
                (open || highlighted) && "ring-2 ring-inset ring-primary",
                highlighted && !open && "bg-primary/10",
              )}
            >
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => onOpen(row.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-start",
                  "cursor-pointer outline-none transition-colors",
                  "hover:bg-muted/60 active:bg-muted",
                  "focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Clock
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <LtrIsolate className="text-lg font-semibold leading-none">
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
                <span className="flex shrink-0 items-center gap-1 self-center">
                  <StatusBadge status={row.status} locale={locale} />
                  <ChevronRight
                    aria-hidden
                    className="size-5 text-muted-foreground rtl:rotate-180"
                  />
                </span>
                <span className="sr-only">{ui("owner.openBooking", locale)}</span>
              </button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function UpcomingRowActions({
  row,
  tenantSlug,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  cancelRef,
  onCancelBooking,
}: {
  row: UpcomingRowView;
  tenantSlug: string;
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  cancelRef: Ref<HTMLButtonElement>;
  onCancelBooking: () => void;
}) {
  const [mixedOpen, setMixedOpen] = useState(false);
  const canCollect = mayCollect && row.status !== "paid";

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
            {keepTenantQuery(tenantSlug)}
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
                {keepTenantQuery(tenantSlug)}
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
            {keepTenantQuery(tenantSlug)}
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
