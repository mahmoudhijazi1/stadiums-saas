"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import type { OutcomeNotify } from "@/modules/booking/domain/outcome-notify";
import type { FeeActions } from "@/modules/booking/ui/fee-forms";
import type { ItemsActions } from "@/modules/booking/ui/booking-items";
import type { ExtendActions } from "@/modules/booking/ui/extend-form";
import type { SeriesActions } from "@/modules/booking/ui/series-manage";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import { DebtRow } from "@/modules/booking/ui/debt-row";
import { EmptyState } from "@/components/ui/empty-state";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { BookingSheet } from "@/modules/booking/ui/booking-sheet/booking-sheet";
import type { CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { owesCash, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import type { SheetStep } from "@/modules/booking/ui/booking-sheet/sheet-header";
import { EarlierDebtsHeader } from "@/modules/booking/ui/earlier-debts-header";
import { UpcomingRows } from "@/modules/booking/ui/upcoming-rows";
import { CancelledToggle, GroupHeading, NowCard } from "@/modules/booking/ui/day-groups";
import { groupDayGames } from "@/modules/booking/domain/today-groups";

export type { UpcomingRowView };

export function UpcomingPanel({
  isToday,
  toCollect,
  toCollectHasMore,
  toCollectUsd,
  toCollectLbp,
  free,
  games,
  locale,
  mayCollect,
  mayCancel,
  mayNoShow,
  mayAdjust,
  highlight,
  openHighlight = false,
  saved,
  date,
  lbpPerUsd = null,
  shop = { products: [], maySell: false },
  collectActions,
  extendActions,
  itemsActions,
  seriesActions,
  feeActions,
}: {
  /** The selected day is today: games are grouped Now, Ended, Upcoming, Cancelled; another day is one list. */
  isToday: boolean;
  toCollect: UpcomingRowView[];
  toCollectHasMore: boolean;
  /** The exact dollars owed by ALL games from earlier days ("30.00"), not just the listed rows. */
  toCollectUsd: string;
  /** The exact pounds owed by all of them ("2000000"). */
  toCollectLbp: string;
  /** Rendered after the day's games: the available-hours section. */
  free?: ReactNode;
  games: UpcomingRowView[];
  locale: UiLocale;
  mayCollect: boolean;
  mayCancel: boolean;
  mayNoShow: boolean;
  mayAdjust: boolean;
  highlight?: string;
  /** Open the highlighted game's sheet on arrival (a link from Money). */
  openHighlight?: boolean;
  saved?: OutcomeNotify | null;
  date?: string;
  /** Current exchange rate for the mixed-currency collect line; null when none is set. */
  lbpPerUsd?: string | null;
  /** The shop catalog for "Add items" on a game, and whether this member may sell. */
  shop?: { products: SellItem[]; maySell: boolean };
  /** The page passes the real Server Actions, grouped by feature; this component never imports one. */
  collectActions: CollectActions;
  extendActions: ExtendActions;
  itemsActions: ItemsActions;
  seriesActions: SeriesActions;
  feeActions: FeeActions;
}) {
  const [openId, setOpenId] = useState<string | null>(() => (openHighlight && highlight ? highlight : null));
  const [heldRow, setHeldRow] = useState<UpcomingRowView | null>(null);
  const [sheetStep, setSheetStep] = useState<SheetStep>("details");
  const [interestOpen, setInterestOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const groups = groupDayGames(games, isToday);
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
  const cancelledShown =
    cancelledOpen || games.some((row) => row.display.kind === "cancelled" && (row.id === openId || row.id === highlight));
  const confirmSubmitRef = useRef<HTMLButtonElement>(null);
  const cancelBookingRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<"confirm" | "cancel" | null>(null);
  const [savedOpened, setSavedOpened] = useState(false);
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

  // A saved outcome opens its booking's sheet once, as soon as the row is in the lists (derived
  // during render, not in an effect).
  const savedRow = saved ? ([...toCollect, ...games].find((item) => item.id === saved.bookingId) ?? null) : null;
  if (saved && savedRow && !savedOpened) {
    setSavedOpened(true);
    setSheetStep("details");
    setInterestOpen(true);
    setHeldRow(savedRow);
    setOpenId(saved.bookingId);
  }

  return (
    <div className="flex flex-col gap-3">
      {toCollect.length > 0 ? (
        <section
          id="earlier-debts"
          aria-labelledby="earlier-debts-heading"
          className="flex scroll-mt-4 flex-col gap-2"
        >
          <EarlierDebtsHeader
            usd={toCollectUsd}
            lbp={toCollectLbp}
            locale={locale}
            expandable={toCollect.length > 1}
            expanded={collectShown}
            onToggle={() => setCollectOpen((open) => !open)}
          />
          {toCollect.length === 1 || collectShown ? (
            <div id="to-collect-list" className="flex flex-col gap-2">
              {toCollect.map((row) => (
                <div key={`collect-${row.id}`} id={`collect-${row.id}`}>
                  <DebtRow
                    row={{
                      id: row.id,
                      dayLabel: row.dayLabel,
                      timeRange: row.timeRange,
                      requesterName: row.requesterName,
                      owedUsd: row.displayAmountUsd,
                      owedText: row.lbp?.pill,
                      pitchName: row.pitchName,
                    }}
                    mayCollect={mayCollect && owesCash(row)}
                    highlighted={highlight === row.id}
                    open={openId === row.id}
                    onOpen={openRowSheet}
                    locale={locale}
                  />
                </div>
              ))}
              {toCollectHasMore ? (
                <Link
                  href="/owner/money"
                  className="inline-flex min-h-11 items-center self-start text-sm font-semibold outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {ui("owner.seeAll", locale)}
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {games.length > 0 ? (
        <section aria-labelledby="today-games-heading" className="flex flex-col gap-4">
          <h2 id="today-games-heading" className="sr-only">
            {ui("owner.gamesHeading", locale)} (<LtrIsolate>{games.length}</LtrIsolate>)
          </h2>
          {groups.map((group) => {
            const rows = (
              <UpcomingRows
                rows={group.items}
                openId={openId}
                onOpen={openRowSheet}
                onOpenInterests={openInterestSheet}
                locale={locale}
                highlight={highlight}
                rowKeyPrefix="day"
              />
            );
            if (group.kind === "cancelled") {
              return (
                <div key={group.kind} className="flex flex-col gap-2">
                  <CancelledToggle
                    count={group.items.length}
                    expanded={cancelledShown}
                    onToggle={() => setCancelledOpen((open) => !open)}
                    locale={locale}
                  />
                  {cancelledShown ? <div id="cancelled-list">{rows}</div> : null}
                </div>
              );
            }
            if (group.kind === "now") return <NowCard key={group.kind}>{rows}</NowCard>;
            return (
              <div key={group.kind} className="flex flex-col gap-2">
                {group.showHeading ? <GroupHeading kind={group.kind} count={group.items.length} locale={locale} /> : null}
                {rows}
              </div>
            );
          })}
        </section>
      ) : (
        <EmptyState title={ui("empty.games", locale)} next={ui("empty.gamesNext", locale)} compact />
      )}

      {free ? <Fragment key="free-strip">{free}</Fragment> : null}

      <BookingSheet
        sheetRow={sheetRow}
        open={openId !== null}
        onClose={closeSheet}
        locale={locale}
        interestOpen={interestOpen}
        saved={saved}
        sheetStep={sheetStep}
        moveStep={moveStep}
        confirmRef={confirmSubmitRef}
        cancelRef={cancelBookingRef}
        mayCollect={mayCollect}
        mayCancel={mayCancel}
        mayNoShow={mayNoShow}
        mayAdjust={mayAdjust}
        date={date}
        lbpPerUsd={lbpPerUsd}
        shop={shop}
        collectActions={collectActions}
        extendActions={extendActions}
        itemsActions={itemsActions}
        seriesActions={seriesActions}
        feeActions={feeActions}
      />
    </div>
  );
}
