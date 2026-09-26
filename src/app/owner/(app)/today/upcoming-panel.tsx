"use client";

import { useLayoutEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UiLocale } from "@/lib/locale";
import {
  collectUsdLabel,
  ui,
  uiCount,
} from "@/lib/ui-copy";
import {
  CountedPhrase,
  InterestPanel,
  NotifyPersonRow,
  type NotifyPerson,
} from "@/app/owner/notify-list";
import type { OutcomeNotify } from "@/modules/booking/application/load-outcome-notify";
import {
  AdjustDueForm,
  CancelDecisionForm,
  NoShowDecisionForm,
} from "./fee-forms";
import { submitCollectPayment } from "./actions";
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
import { ClockRangeText, LtrIsolate } from "@/components/ui/ltr-isolate";
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
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  remainingUsd: string;
  priceUsd: string;
  interested: NotifyPerson[];
  status: UpcomingStatus;
  display: CardDisplay;
  displayAmountUsd: string;
  confirmWhatsAppHref: string | null;
  showCancel: boolean;
  showNoShow: boolean;
  canAdjust: boolean;
  hoursBefore: number;
  playerFeeCompact: string | null;
  playerFeeExact: string;
  ownerFeeCompact: string | null;
  ownerFeeExact: string;
  noShowFeeCompact: string | null;
  noShowFeeExact: string;
  collectedExact: string;
  collectedCompact: string;
  stadiumName: string;
  waDay: string;
  waTime: string;
};

function owesCash(row: UpcomingRowView): boolean {
  if (row.status === "paid") return false;
  return (
    row.display.kind === "unpaid" ||
    row.display.kind === "partial" ||
    row.display.kind === "no_show_unpaid" ||
    row.display.kind === "cancelled"
  );
}

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

type SheetStep = "details" | "cancel" | "noshow" | "adjust";

export function UpcomingPanel({
  toCollect,
  toCollectHasMore,
  games,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  highlight,
  saved,
  date,
}: {
  toCollect: UpcomingRowView[];
  toCollectHasMore: boolean;
  games: UpcomingRowView[];
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  highlight?: string;
  saved?: OutcomeNotify | null;
  date?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [heldRow, setHeldRow] = useState<UpcomingRowView | null>(null);
  const [sheetStep, setSheetStep] = useState<SheetStep>("details");
  const [interestOpen, setInterestOpen] = useState(false);
  const openRow =
    [...toCollect, ...games].find((row) => row.id === openId) ?? null;
  const sheetRow = openRow ?? heldRow;
  const confirmSubmitRef = useRef<HTMLButtonElement>(null);
  const cancelBookingRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<"confirm" | "cancel" | null>(null);
  const savedOpenedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function closeSheet() {
    setOpenId(null);
    setInterestOpen(false);
    if (!saved) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("notify");
    next.delete("bookingId");
    next.delete("freed");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function moveStep(next: SheetStep) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    pendingFocusRef.current = next === "details" ? "cancel" : "confirm";
    setSheetStep(next);
  }

  useLayoutEffect(() => {
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target === "confirm") confirmSubmitRef.current?.focus();
    if (target === "cancel") cancelBookingRef.current?.focus();
  }, [sheetStep]);

  function openRowSheet(id: string) {
    const row =
      [...toCollect, ...games].find((item) => item.id === id) ?? null;
    if (!row) return;
    setSheetStep("details");
    setInterestOpen(false);
    setHeldRow(row);
    setOpenId(id);
  }

  function openInterestSheet(id: string) {
    const row =
      [...toCollect, ...games].find((item) => item.id === id) ?? null;
    if (!row || row.interested.length === 0) return;
    setSheetStep("details");
    setInterestOpen(true);
    setHeldRow(row);
    setOpenId(id);
  }

  useLayoutEffect(() => {
    if (!saved || savedOpenedRef.current) return;
    const row =
      [...toCollect, ...games].find((item) => item.id === saved.bookingId) ??
      null;
    if (!row) return;
    savedOpenedRef.current = true;
    setSheetStep("details");
    setInterestOpen(true);
    setHeldRow(row);
    setOpenId(saved.bookingId);
  }, [saved, toCollect, games]);

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
            onOpenInterests={openInterestSheet}
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
          onOpenInterests={openInterestSheet}
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
                  sheetStep !== "details"
                    ? stepTitle(sheetStep, locale)
                    : sheetRow.timeRange
                }
              >
                <span className="grid">
                  <span
                    className={cn(
                      "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                      sheetStep !== "details" ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden={sheetStep === "details"}
                  >
                    {stepTitle(sheetStep, locale)}
                  </span>
                  <span
                    className={cn(
                      "col-start-1 row-start-1 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                      sheetStep !== "details" ? "opacity-0" : "opacity-100",
                    )}
                    aria-hidden={sheetStep !== "details"}
                  >
                    <ClockRangeText
                      text={sheetRow.timeRange}
                      className="text-xl font-bold leading-none"
                    />
                  </span>
                </span>
              </BottomSheetTitle>
              <BottomSheetDescription>
                {sheetRow.pitchName}
                {toCollect.some((item) => item.id === sheetRow.id)
                  ? ` · ${sheetRow.dateLabel}`
                  : null}
                {" · "}
                <Link
                  href={`/owner/people/${sheetRow.requesterPersonId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {sheetRow.requesterName}
                </Link>
              </BottomSheetDescription>
            </BottomSheetHeader>
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
            <div className="flex flex-col gap-2 px-4 pt-2">
              {sheetRow.requesterPhone ? (
                <p className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone aria-hidden className="size-3.5 shrink-0" />
                  <LtrIsolate>{sheetRow.requesterPhone}</LtrIsolate>
                </p>
              ) : null}
              {sheetStep === "details" && sheetRow.confirmWhatsAppHref ? (
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
              stage={sheetStep !== "details" ? "confirm" : "details"}
              active={openId !== null}
            >
              <BottomSheetBody
                className={cn(
                  "flex flex-col gap-4 pb-4 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  sheetStep !== "details" &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={sheetStep !== "details" ? true : undefined}
              >
                <UpcomingRowActions
                  key={`${sheetRow.id}:${sheetRow.remainingUsd}`}
                  row={sheetRow}
                  locale={locale}
                  mayCollect={mayCollect}
                  mayCancel={mayCancel}
                  mayNoShow={mayNoShow}
                  mayAdjust={mayAdjust}
                  cancelRef={cancelBookingRef}
                  onCancelBooking={() => moveStep("cancel")}
                  onNoShow={() => moveStep("noshow")}
                  onAdjust={() => moveStep("adjust")}
                />
              </BottomSheetBody>
              <BottomSheetBody
                className={cn(
                  "flex flex-none flex-col gap-3 overflow-hidden pb-4 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  sheetStep === "details" &&
                    "pointer-events-none absolute inset-x-0 top-0 opacity-0",
                )}
                inert={sheetStep === "details" ? true : undefined}
              >
                {sheetStep === "cancel" ? (
                  <CancelDecisionForm
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    mayAdjust={mayAdjust}
                    confirmRef={confirmSubmitRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "noshow" ? (
                  <NoShowDecisionForm
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    mayAdjust={mayAdjust}
                    confirmRef={confirmSubmitRef}
                    onBack={() => moveStep("details")}
                  />
                ) : null}
                {sheetStep === "adjust" ? (
                  <AdjustDueForm
                    row={sheetRow}
                    locale={locale}
                    date={date}
                    confirmRef={confirmSubmitRef}
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
    </div>
  );
}

function stepTitle(step: SheetStep, locale: UiLocale): string {
  if (step === "noshow") return ui("owner.noShow", locale);
  if (step === "adjust") return ui("owner.adjustDue", locale);
  return ui("owner.cancel", locale);
}

function UpcomingRows({
  rows,
  showDate,
  openId,
  onOpen,
  onOpenInterests,
  locale,
  highlight,
  mayCollect,
  rowKeyPrefix,
}: {
  rows: UpcomingRowView[];
  showDate: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
  onOpenInterests: (id: string) => void;
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
              <div className="flex w-full items-center">
                <div className="min-w-0 flex-1 px-4 py-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => onOpen(row.id)}
                    className={cn(
                      "w-full cursor-pointer bg-transparent text-start outline-none",
                      "focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Clock
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <ClockRangeText
                        text={row.timeRange}
                        className={cn(
                          "text-lg font-semibold leading-none whitespace-nowrap",
                          row.display.kind === "cancelled" &&
                            "text-muted-foreground line-through",
                        )}
                      />
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin aria-hidden className="size-4 shrink-0" />
                        {row.pitchName}
                      </span>
                      {showDate ? <span>{row.dateLabel}</span> : null}
                    </span>
                    <span className="sr-only">{ui("owner.openBooking", locale)}</span>
                  </button>
                  <Link
                    href={`/owner/people/${row.requesterPersonId}`}
                    className="mt-1 block min-h-11 truncate py-2 text-sm text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {row.requesterName}
                  </Link>
                  {row.interested.length > 0 ? (
                    <button
                      type="button"
                      className="mt-1 inline-flex min-h-11 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => onOpenInterests(row.id)}
                    >
                      <CountedPhrase
                        text={uiCount(
                          "owner.interested",
                          row.interested.length,
                          locale,
                        )}
                      />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={ui("owner.openBooking", locale)}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={() => onOpen(row.id)}
                  className="flex shrink-0 cursor-pointer flex-col items-end gap-1 self-stretch bg-transparent px-4 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                >
                  <span className="my-auto flex flex-col items-end gap-1">
                    <CardTrail
                      display={row.display}
                      amountUsd={row.displayAmountUsd}
                      locale={locale}
                    />
                {mayCollect && owesCash(row) ? null : (
                      <ChevronRight
                        aria-hidden
                        className="size-5 text-muted-foreground rtl:rotate-180"
                      />
                    )}
                  </span>
                </button>
                {mayCollect && owesCash(row) ? (
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
  mayAdjust,
  cancelRef,
  onCancelBooking,
  onNoShow,
  onAdjust,
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
}) {
  const [mixedOpen, setMixedOpen] = useState(false);
  const canCollect = mayCollect && owesCash(row);

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
        {mayAdjust && row.canAdjust ? (
          <Button type="button" variant="outline" className="w-full" onClick={onAdjust}>
            {ui("owner.adjustDue", locale)}
          </Button>
        ) : null}
        {mayNoShow && row.showNoShow ? (
          <Button type="button" variant="outline" className="w-full" onClick={onNoShow}>
            {ui("owner.noShow", locale)}
          </Button>
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
