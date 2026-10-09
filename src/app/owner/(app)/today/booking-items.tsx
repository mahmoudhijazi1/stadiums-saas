"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { Minus } from "lucide-react";
import { toast } from "sonner";
import type { SellItem } from "@/app/owner/item-tiles";
import { PartsBalance } from "@/app/owner/parts-balance";
import { TonalCollectButton } from "@/app/owner/tonal-collect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatLbpAmount, formatParts, formatUsdAmount } from "@/lib/money-display";
import { changeDescription, ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { AddItemsSheet } from "./add-items-sheet";
import { submitCollectTab, submitRemoveBookingItem } from "./items-actions";

/** A line in the currency of its item: `unit` and `total` are USD amounts ("1.50") or whole pounds ("20000"). */
export type ItemLineView = { id: string; name: string; qty: number; currency: "USD" | "LBP"; unit: string; total: string };

export type TabItemsView = {
  saleId: string;
  /** Null when the tab was opened under a typed name. */
  personId: string | null;
  name: string;
  lines: ItemLineView[];
  /** What is still owed, in the currency of the items: pounds for LBP items, dollars for USD items. */
  remainingLbp: string;
  remainingUsd: string;
  /** Something has been paid on it (the USD recorded, "0.00" when nothing). */
  paidUsd: string;
};

/** What the booking sheet knows about the shop items of one game (plain strings: it crosses to the client). */
export type BookingItemsPanelView = {
  tabs: TabItemsView[];
  /** The tabs are owed now (the game ended, or it was a no-show or cancelled): amber. Before that: neutral. */
  tabsOwed: boolean;
  /** The booking's requester: "On the game (booker)" charges her tab. */
  bookerPersonId: string;
  bookerName: string;
};

const own = (currency: "USD" | "LBP", value: string, locale: UiLocale) =>
  currency === "LBP" ? formatLbpAmount(value, locale) : formatUsdAmount(value);

/**
 * The shop on one game, inside the booking sheet: a "Shop" heading with a small "+ Add", then one
 * compact row per player tab (the booker's included). A tab never changes the game amount or a
 * slot. Prices never come from here: only ids and quantities go to the server.
 */
export function BookingItems({
  bookingId,
  canAdd,
  mayRemove,
  mayCollect,
  products,
  view,
  lbpPerUsd,
  locale,
}: {
  bookingId: string;
  /** The game is confirmed and the member may sell. */
  canAdd: boolean;
  mayRemove: boolean;
  mayCollect: boolean;
  products: SellItem[];
  view: BookingItemsPanelView;
  lbpPerUsd: string | null;
  locale: UiLocale;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const empty = view.tabs.length === 0;
  const mayAdd = canAdd && products.length > 0;
  if (empty && !mayAdd) return null;

  function remove(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitRemoveBookingItem({ itemId, qty: 1 });
      if ("error" in result) setError(errorMessage(result.error, locale));
      else router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="type-section">{ui("owner.shop", locale)}</h4>
        {mayAdd ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="-my-1.5 inline-flex min-h-11 items-center outline-none focus-visible:[&>span]:ring-[3px] focus-visible:[&>span]:ring-ring/50"
          >
            <span className="inline-flex h-9 items-center rounded-full px-3 type-label text-action-ink hover:bg-muted">
              {ui("owner.shopAddShort", locale)}
            </span>
          </button>
        ) : null}
      </div>

      {view.tabs.map((tab) => (
        <TabRow
          key={tab.saleId}
          tab={tab}
          owedNow={view.tabsOwed}
          mayRemove={mayRemove}
          mayCollect={mayCollect}
          onRemove={remove}
          busy={pending}
          lbpPerUsd={lbpPerUsd}
          locale={locale}
          onDone={() => router.refresh()}
        />
      ))}

      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}

      {mayAdd ? (
        <AddItemsSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          bookingId={bookingId}
          bookerName={view.bookerName}
          bookerPersonId={view.bookerPersonId}
          tabPayers={view.tabs.map((tab) => ({ personId: tab.personId, name: tab.name }))}
          products={products}
          lbpPerUsd={lbpPerUsd}
          locale={locale}
          onDone={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}

function ItemLines({
  lines,
  removable,
  onRemove,
  busy,
  locale,
}: {
  lines: ItemLineView[];
  removable: boolean;
  onRemove: (itemId: string) => void;
  busy: boolean;
  locale: UiLocale;
}) {
  return (
    <ul className="overflow-hidden rounded-xl border bg-card">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-2 border-b ps-4 pe-1 last:border-b-0">
          <span className="type-body min-w-0 flex-1 truncate py-2">
            <bdi>{line.name}</bdi>
          </span>
          <span className="type-secondary shrink-0">
            <LtrIsolate>{`${line.qty} × ${own(line.currency, line.unit, locale)} = ${own(line.currency, line.total, locale)}`}</LtrIsolate>
          </span>
          {removable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(line.id)}
              aria-label={`${ui("owner.sellMinus", locale)} ${line.name}`}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <Minus aria-hidden className="size-4" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** "Water S ×2, Cola ×1": what the tab is made of, on one line, joined the way the language joins a list. */
function summaryOf(lines: ItemLineView[], locale: UiLocale): string {
  const parts = lines.map((line) => `${line.name} ×${line.qty}`);
  return new Intl.ListFormat(locale === "en" ? "en" : "ar", { type: "unit", style: "short" }).format(parts);
}

/**
 * One compact row per tab: payer, item summary, the amount in its own currency and a tonal Collect
 * that takes exactly what is owed in one tap (the common case). Tapping the row opens its lines with
 * the remove control and "Pay another way" for a part or other cash. The row and the button are
 * siblings, never nested.
 */
function TabRow({
  tab,
  owedNow,
  mayRemove,
  mayCollect,
  onRemove,
  busy,
  lbpPerUsd,
  locale,
  onDone,
}: {
  tab: TabItemsView;
  /** Owed (amber) once the game has ended; neutral before. Collecting early stays allowed. */
  owedNow: boolean;
  mayRemove: boolean;
  mayCollect: boolean;
  onRemove: (itemId: string) => void;
  busy: boolean;
  lbpPerUsd: string | null;
  locale: UiLocale;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const remaining = { lbp: new Decimal(tab.remainingLbp), usd: new Decimal(tab.remainingUsd) };
  const owes = remaining.lbp.gt(0) || remaining.usd.gt(0);
  const hasPayments = new Decimal(tab.paidUsd).gt(0);
  const remainingText = formatParts(remaining, locale);
  // Exactly what is owed, in the currencies it is owed in.
  const exactUsd = remaining.usd.gt(0) ? remaining.usd.toFixed(2) : "";
  const exactLbp = remaining.lbp.gt(0) ? remaining.lbp.toFixed(0) : "";

  function send(usdAmount: string, lbpAmount: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitCollectTab({ saleId: tab.saleId, usdAmount, lbpAmount });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      const description = changeDescription({ lbp: result.changeLbp ?? "0", usd: result.changeUsd ?? "0" }, locale, lbpPerUsd);
      if (description) toast.success(description, { duration: 8000 });
      setPaying(false);
      onDone();
    });
  }

  function openOther() {
    setUsd(exactUsd);
    setLbp(exactLbp);
    setError(null);
    setPaying(true);
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 ps-3 pe-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 rounded-lg py-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="type-strong max-w-full truncate">
            <bdi>{tab.name}</bdi>
          </span>
          <span className="type-secondary max-w-full truncate">
            <bdi>{summaryOf(tab.lines, locale)}</bdi>
          </span>
        </button>
        <span className={cn("type-strong shrink-0", !owes ? "text-paid" : owedNow ? "text-owed" : "text-expected")}>
          {owes ? <LtrIsolate>{remainingText}</LtrIsolate> : ui("owner.paidInFull", locale)}
        </span>
        {owes && mayCollect ? (
          <TonalCollectButton tone={owedNow ? "owed" : "expected"} disabled={pending} onClick={() => send(exactUsd, exactLbp)}>
            {ui("owner.collect", locale)}
          </TonalCollectButton>
        ) : null}
      </div>
      {error && !expanded ? (
        <p role="alert" className="type-secondary px-3 pb-2 text-owed">
          {error}
        </p>
      ) : null}
      {expanded ? (
        <div className="flex flex-col gap-3 border-t p-3">
          <ItemLines lines={tab.lines} removable={mayRemove && !hasPayments} onRemove={onRemove} busy={busy} locale={locale} />
          {owes && mayCollect && !paying ? (
            <button
              type="button"
              onClick={openOther}
              className="inline-flex min-h-11 w-fit items-center type-label text-action-ink underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {ui("owner.payAnotherWay", locale)}
            </button>
          ) : null}
          {paying ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`tab-lbp-${tab.saleId}`}>{ui("owner.lbp", locale)}</Label>
                <Input
                  id={`tab-lbp-${tab.saleId}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={lbp}
                  onChange={(event) => setLbp(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`tab-usd-${tab.saleId}`}>USD</Label>
                <Input
                  id={`tab-usd-${tab.saleId}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={usd}
                  onChange={(event) => setUsd(event.target.value)}
                />
              </div>
              <PartsBalance owed={remaining} usdText={usd} lbpText={lbp} lbpPerUsd={lbpPerUsd} locale={locale} />
              {error ? (
                <p role="alert" className="type-secondary text-owed">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPaying(false)}>
                  {ui("dialog.close", locale)}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => send(usd, lbp)} disabled={pending}>
                  {ui("owner.collect", locale)}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
