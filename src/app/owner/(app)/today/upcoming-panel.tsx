"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
import { PersonLink } from "@/app/owner/person-link";
import { PerPlayerCollect, type PerPlayerView } from "./per-player-collect";
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
import { Figure } from "@/components/ui/figure";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ClockRangeText, LtrIsolate } from "@/components/ui/ltr-isolate";
import { cn } from "cn";
import { TenderBalance } from "@/app/owner/tender-balance";
import type { CardDisplay } from "@/modules/booking/domain/card-display";
import type { UpcomingStatus } from "@/modules/booking/domain/home-inbox";
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  MessageCircle,
  Phone,
  Radio,
} from "lucide-react";

export type UpcomingRowView = {
  id: string;
  /** Null when the stadium has one pitch: the name would say nothing. */
  pitchName: string | null;
  timeRange: string;
  dateLabel: string;
  /** "night of Friday" for a 00:00–05:59 start, else null. */
  nightHint: string | null;
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
  perPlayer: PerPlayerView;
  hoursBefore: number;
  playerFeeCompact: string | null;
  playerFeeExact: string;
  ownerFeeCompact: string | null;
  ownerFeeExact: string;
  /** "I cancelled" would store less than the player path: needs bookings.adjust_due. */
  ownerCancelLowersFee: boolean;
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
      <span className="inline-flex items-center gap-1 text-sm font-medium text-owed">
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
        <CircleCheck aria-hidden className="size-4 shrink-0 text-paid" />
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
      <span className="inline-flex items-center gap-1 text-sm font-medium text-owed">
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
      <span className="inline-flex items-center gap-1 text-sm font-medium text-paid">
        <CircleCheck aria-hidden className="size-4 shrink-0" />
        <span>{ui("owner.paid", locale)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <span>{ui("owner.gameWord", locale)}</span>
      <LtrIsolate>${amountUsd}</LtrIsolate>
    </span>
  );
}

type MoneyTone = "paid" | "owed" | "expected";

const TONE_TEXT: Record<MoneyTone, string> = {
  paid: "text-paid",
  owed: "text-owed",
  expected: "text-expected",
};
const TONE_BG: Record<MoneyTone, string> = {
  paid: "bg-paid-subtle",
  owed: "bg-owed-subtle",
  expected: "bg-expected-subtle",
};

/** Paid = settled, owed = the game ended and money is due, expected = not played yet. */
function moneyTone(row: UpcomingRowView): MoneyTone {
  if (row.remainingUsd === "0.00") return "paid";
  return owesCash(row) ? "owed" : "expected";
}

function DueRemainingFigures({
  dueUsd,
  paidUsd,
  remainingUsd,
  tone,
  locale,
}: {
  dueUsd: string;
  paidUsd: string;
  remainingUsd: string;
  tone: MoneyTone;
  locale: UiLocale;
}) {
  // Paid shows what was taken; a split into Game / Owed only when they differ.
  const same = tone === "paid" || dueUsd === remainingUsd;
  const Icon = tone === "paid" ? CircleCheck : tone === "owed" ? CircleAlert : null;
  const remaining = (
    <div className={cn("rounded-lg px-3 py-3 text-start", TONE_BG[tone])}>
      <p className={cn("flex items-center gap-1 text-xs", TONE_TEXT[tone])}>
        {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
        {ui(
          tone === "paid"
            ? "owner.paid"
            : tone === "owed"
              ? "owner.remaining"
              : "owner.expectedLabel",
          locale,
        )}
      </p>
      <Figure className={cn("mt-0.5 block text-2xl", TONE_TEXT[tone])}>
        ${tone === "paid" ? paidUsd : remainingUsd}
      </Figure>
    </div>
  );

  if (same) return remaining;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-muted px-3 py-2 text-start">
        <p className="text-xs text-muted-foreground">{ui("owner.gameWord", locale)}</p>
        <p className="mt-0.5 text-base font-semibold text-foreground">
          <LtrIsolate>${dueUsd}</LtrIsolate>
        </p>
      </div>
      {remaining}
    </div>
  );
}

type SheetStep = "details" | "cancel" | "noshow" | "adjust";

export function UpcomingPanel({
  toCollect,
  toCollectHasMore,
  toCollectTotal,
  between,
  games,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  highlight,
  saved,
  date,
  lbpPerUsd = null,
}: {
  toCollect: UpcomingRowView[];
  toCollectHasMore: boolean;
  /** Compact USD sum of the listed To collect rows. */
  toCollectTotal: string;
  /** Rendered between To collect and the day's games (summary line, free strip). */
  between?: ReactNode;
  games: UpcomingRowView[];
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  highlight?: string;
  saved?: OutcomeNotify | null;
  date?: string;
  /** Current exchange rate for the mixed-currency collect line; null when none is set. */
  lbpPerUsd?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [heldRow, setHeldRow] = useState<UpcomingRowView | null>(null);
  const [sheetStep, setSheetStep] = useState<SheetStep>("details");
  const [interestOpen, setInterestOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const openRow =
    [...toCollect, ...games].find((row) => row.id === openId) ?? null;
  // The open booking left both lists: an ended game from an earlier day leaves "To
  // collect" once it is settled (last player paid, or due adjusted). heldRow is the
  // snapshot from when the sheet opened, so it would offer Pay/Collect again on money
  // already taken (the server then answers payment.nothing_due). Close instead, unless
  // the sheet is showing this booking's WhatsApp notify, which needs the snapshot.
  if (openId !== null && openRow === null && saved?.bookingId !== openId) {
    setOpenId(null);
    setInterestOpen(false);
  }
  const sheetRow = openRow ?? heldRow;
  // Amber and never hidden: a highlighted or opened card forces the list open.
  const collectShown =
    collectOpen ||
    toCollect.some((row) => row.id === openId || row.id === highlight);
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
          <button
            type="button"
            aria-expanded={collectShown}
            aria-controls="to-collect-list"
            onClick={() => setCollectOpen((open) => !open)}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-owed/60 bg-owed-subtle text-owed px-4 py-3 text-start text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <CollectCount
                text={uiCount("owner.toCollectGames", toCollect.length, locale)}
                plus={toCollectHasMore}
              />
              <span aria-hidden> · </span>
              <LtrIsolate>{`$${toCollectTotal}${toCollectHasMore ? "+" : ""}`}</LtrIsolate>
            </span>
            <ChevronDown
              aria-hidden
              className={cn("size-5 shrink-0 transition-transform", collectShown && "rotate-180")}
            />
          </button>
          {collectShown ? (
            <div id="to-collect-list" className="flex flex-col gap-3">
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
            </div>
          ) : null}
        </>
      ) : null}

      {between}

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
                {[
                  sheetRow.pitchName,
                  toCollect.some((item) => item.id === sheetRow.id)
                    ? sheetRow.dateLabel
                    : null,
                  sheetRow.nightHint,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </BottomSheetDescription>
              <PersonLink
                personId={sheetRow.requesterPersonId}
                name={sheetRow.requesterName}
              />
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
                  lbpPerUsd={lbpPerUsd}
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

function CollectCount({ text, plus }: { text: string; plus: boolean }) {
  const match = /^(\D*)(\d+)(.*)$/.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]}
      <LtrIsolate>{`${match[2]}${plus ? "+" : ""}`}</LtrIsolate>
      {match[3]}
    </>
  );
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
                      <ClockRangeText
                        text={row.timeRange}
                        className={cn(
                          "text-lg font-semibold leading-none whitespace-nowrap",
                          row.display.kind === "cancelled" &&
                            "text-muted-foreground line-through",
                        )}
                      />
                    </span>
                    {row.pitchName || showDate || row.nightHint ? (
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {row.pitchName ? <span>{row.pitchName}</span> : null}
                        {showDate ? <span>{row.dateLabel}</span> : null}
                        {row.nightHint ? <span>{row.nightHint}</span> : null}
                      </span>
                    ) : null}
                    <span className="mt-1.5 block truncate text-sm text-muted-foreground">
                      <bdi>{row.requesterName}</bdi>
                    </span>
                    <span className="sr-only">{ui("owner.openBooking", locale)}</span>
                  </button>
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
  lbpPerUsd,
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
  lbpPerUsd: string | null;
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
  const perPlayer = row.perPlayer.mode === "PER_PLAYER";
  const canCollect = mayCollect && owesCash(row) && !perPlayer;

  return (
    <>
      <div className="flex flex-col gap-4">
        {canCollect || (perPlayer && mayCollect) ? (
          <h4 className="text-xs font-medium text-muted-foreground">
            {ui("owner.moneyGroup", locale)}
          </h4>
        ) : null}
        <DueRemainingFigures
          dueUsd={row.priceUsd}
          paidUsd={row.collectedExact}
          remainingUsd={row.remainingUsd}
          tone={moneyTone(row)}
          locale={locale}
        />
        <PerPlayerCollect
          view={row.perPlayer}
          mayCollect={mayCollect}
          mayAdjust={mayAdjust && (perPlayer || owesCash(row))}
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
              <MixedCollectForm row={row} lbpPerUsd={lbpPerUsd} locale={locale} />
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

/**
 * USD + LBP collect. Both fields are controlled so the line under them shows the total
 * and what is left as the owner types; "Complete with … LBP" fills the rest.
 */
function MixedCollectForm({
  row,
  lbpPerUsd,
  locale,
}: {
  row: UpcomingRowView;
  lbpPerUsd: string | null;
  locale: UiLocale;
}) {
  const [usd, setUsd] = useState(row.remainingUsd);
  const [lbp, setLbp] = useState("");

  return (
    <form action={submitCollectPayment} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={row.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`usd-${row.id}`}>{ui("owner.usdRemaining", locale)}</Label>
        <Input
          id={`usd-${row.id}`}
          type="text"
          name="usdAmount"
          inputMode="decimal"
          value={usd}
          onChange={(event) => setUsd(event.target.value)}
          placeholder={row.remainingUsd}
          className="font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`lbp-${row.id}`}>{ui("owner.lbp", locale)}</Label>
        <Input
          id={`lbp-${row.id}`}
          type="text"
          name="lbpAmount"
          inputMode="numeric"
          value={lbp}
          onChange={(event) => setLbp(event.target.value)}
          className="font-mono"
        />
      </div>
      <TenderBalance
        usdText={usd}
        lbpText={lbp}
        lbpPerUsd={lbpPerUsd}
        targetUsd={row.remainingUsd}
        locale={locale}
        onFillLbp={setLbp}
      />
      <SubmitButton className="w-full">{ui("owner.moneyGroup", locale)}</SubmitButton>
    </form>
  );
}
