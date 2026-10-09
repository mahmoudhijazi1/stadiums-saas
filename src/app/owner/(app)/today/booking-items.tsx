"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ItemTiles, QTY_MAX, partsOf, type SellItem } from "@/app/owner/item-tiles";
import { PartsBalance } from "@/app/owner/parts-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatLbpAmount, formatParts, formatUsdAmount } from "@/lib/money-display";
import { changeDescription, itemsAddedToast, ui } from "@/lib/ui-copy";
import { cn } from "cn";
import {
  searchPayers,
  submitAddBookingItems,
  submitCollectTab,
  submitRemoveBookingItem,
  type PayerHit,
} from "./items-actions";

/** A line in the currency of its item: `unit` and `total` are USD amounts ("1.50") or whole pounds ("20000"). */
export type ItemLineView = { id: string; name: string; qty: number; currency: "USD" | "LBP"; unit: string; total: string };

export type TabItemsView = {
  saleId: string;
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
  /** The named slots (the booker has "On the game (booker)"): quick picks of the payer chooser. */
  players: { personId: string; name: string }[];
};

type Payer = { kind: "game" } | { kind: "person"; personId: string; name: string } | { kind: "name"; name: string; phone: string };

const own = (currency: "USD" | "LBP", value: string, locale: UiLocale) =>
  currency === "LBP" ? formatLbpAmount(value, locale) : formatUsdAmount(value);

function storageKey(bookingId: string): string {
  return `items-payer:${bookingId}`;
}

function loadPayer(bookingId: string): Payer | null {
  try {
    const raw = window.localStorage.getItem(storageKey(bookingId));
    return raw ? (JSON.parse(raw) as Payer) : null;
  } catch {
    return null;
  }
}

function savePayer(bookingId: string, payer: Payer): void {
  try {
    window.localStorage.setItem(storageKey(bookingId), JSON.stringify(payer));
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

/**
 * The shop on one game, inside the booking sheet: each player tab (the booker's included) with its
 * own Collect, and Add items. A tab never changes the game amount or a slot. Prices never come from
 * here: only ids and quantities go to the server.
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
  const [pending, startTransition] = useTransition();
  const empty = view.tabs.length === 0;
  if (empty && (!canAdd || products.length === 0)) return null;

  function remove(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await submitRemoveBookingItem({ itemId, qty: 1 });
      if ("error" in result) setError(errorMessage(result.error, locale));
      else router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold text-muted-foreground">{ui("owner.shop", locale)}</h4>

      {view.tabs.map((tab) => (
        <TabCard
          key={tab.saleId}
          tab={tab}
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

      {canAdd && products.length > 0 ? (
        <AddItems
          bookingId={bookingId}
          products={products}
          players={view.players}
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

function TabCard({
  tab,
  mayRemove,
  mayCollect,
  onRemove,
  busy,
  lbpPerUsd,
  locale,
  onDone,
}: {
  tab: TabItemsView;
  mayRemove: boolean;
  mayCollect: boolean;
  onRemove: (itemId: string) => void;
  busy: boolean;
  lbpPerUsd: string | null;
  locale: UiLocale;
  onDone: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const remaining = { lbp: new Decimal(tab.remainingLbp), usd: new Decimal(tab.remainingUsd) };
  const owes = remaining.lbp.gt(0) || remaining.usd.gt(0);
  const hasPayments = new Decimal(tab.paidUsd).gt(0);
  const remainingText = formatParts(remaining, locale);

  function open() {
    // Exactly what is owed, in the currencies it is owed in: the common case is one tap.
    setUsd(remaining.usd.gt(0) ? remaining.usd.toFixed(2) : "");
    setLbp(remaining.lbp.gt(0) ? remaining.lbp.toFixed(0) : "");
    setError(null);
    setPaying(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitCollectTab({ saleId: tab.saleId, usdAmount: usd, lbpAmount: lbp });
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

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-strong min-w-0 truncate">
          <bdi>{tab.name}</bdi>
        </p>
        <p className={cn("type-strong shrink-0", owes ? "text-owed" : "text-paid")}>
          {owes ? <LtrIsolate>{remainingText}</LtrIsolate> : null}
          <span className="ms-1 type-caption">{ui(owes ? "owner.remaining" : "owner.paidInFull", locale)}</span>
        </p>
      </div>
      <ItemLines lines={tab.lines} removable={mayRemove && !hasPayments} onRemove={onRemove} busy={busy} locale={locale} />
      {owes && mayCollect && !paying ? (
        <Button type="button" className="w-full" onClick={open}>
          {ui("owner.collect", locale)} <LtrIsolate>{remainingText}</LtrIsolate>
        </Button>
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
            <Button type="button" className="flex-1" onClick={submit} disabled={pending}>
              {ui("owner.collect", locale)} <LtrIsolate>{remainingText}</LtrIsolate>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddItems({
  bookingId,
  products,
  players,
  lbpPerUsd,
  locale,
  onDone,
}: {
  bookingId: string;
  products: SellItem[];
  players: { personId: string; name: string }[];
  lbpPerUsd: string | null;
  locale: UiLocale;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [payer, setPayer] = useState<Payer | null>(null);
  const [other, setOther] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PayerHit[]>([]);
  const [typedName, setTypedName] = useState("");
  const [typedPhone, setTypedPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The booker is the default; the last choice for this booking is remembered.
  useEffect(() => {
    setPayer(loadPayer(bookingId) ?? { kind: "game" });
  }, [bookingId]);

  const lines = products.map((item) => ({ item, qty: counts[item.id] ?? 0 })).filter((line) => line.qty > 0);
  const total = partsOf(products, counts);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  function change(id: string, delta: number) {
    setCounts((current) => ({ ...current, [id]: Math.min(QTY_MAX, Math.max(0, (current[id] ?? 0) + delta)) }));
  }

  function choose(next: Payer) {
    setPayer(next);
    savePayer(bookingId, next);
    setError(null);
  }

  function search() {
    startTransition(async () => {
      const result = await searchPayers(query);
      if ("error" in result) setError(errorMessage(result.error, locale));
      else setHits(result.hits);
    });
  }

  function add() {
    if (!payer) {
      setError(errorMessage("shop.player_not_found", locale));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitAddBookingItems({
        bookingId,
        lines: lines.map((line) => ({ productId: line.item.id, qty: line.qty })),
        payer:
          payer.kind === "game"
            ? { kind: "game" }
            : payer.kind === "person"
              ? { kind: "person", personId: payer.personId }
              : { kind: "name", name: payer.name, ...(payer.phone ? { phone: payer.phone } : {}) },
      });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        return;
      }
      toast.success(itemsAddedToast(result.itemCount ?? itemCount, formatParts(total, locale), locale));
      setCounts({});
      setOpen(false);
      onDone();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {ui("owner.addItems", locale)}
      </Button>
    );
  }

  const chip = (selected: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      selected ? "border-transparent bg-selected text-selected-ink" : "bg-card",
    );

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <p className="type-section">{ui("owner.itemsChargeTo", locale)}</p>
      <div className="flex flex-wrap gap-2" role="group">
        <button type="button" className={chip(payer?.kind === "game")} onClick={() => choose({ kind: "game" })}>
          {ui("owner.itemsOnGame", locale)}
        </button>
        {players.map((player) => (
          <button
            key={player.personId}
            type="button"
            className={chip(payer?.kind === "person" && payer.personId === player.personId)}
            onClick={() => choose({ kind: "person", personId: player.personId, name: player.name })}
          >
            <bdi>{player.name}</bdi>
          </button>
        ))}
        {payer?.kind === "person" && !players.some((player) => player.personId === payer.personId) ? (
          <span className={chip(true)}>
            <bdi>{payer.name}</bdi>
          </span>
        ) : null}
        {payer?.kind === "name" ? (
          <span className={chip(true)}>
            <bdi>{payer.name}</bdi>
          </span>
        ) : null}
        <button type="button" className={chip(other)} onClick={() => setOther((value) => !value)}>
          {ui("owner.itemsOtherPlayer", locale)}
        </button>
      </div>

      {other ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ui("owner.itemsSearchPlayer", locale)}
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={search} disabled={pending || query.trim() === ""} aria-label={ui("owner.itemsSearchPlayer", locale)}>
              <Search aria-hidden />
            </Button>
          </div>
          {hits.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className={chip(payer?.kind === "person" && payer.personId === hit.id)}
                    onClick={() => {
                      choose({ kind: "person", personId: hit.id, name: hit.name });
                      setOther(false);
                    }}
                  >
                    <bdi>{hit.name}</bdi>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2">
            <Input
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              placeholder={ui("owner.itemsNameField", locale)}
              autoComplete="off"
            />
            <Input
              value={typedPhone}
              onChange={(event) => setTypedPhone(event.target.value)}
              placeholder={ui("owner.itemsPhoneField", locale)}
              inputMode="tel"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              disabled={typedName.trim() === ""}
              onClick={() => {
                choose({ kind: "name", name: typedName.trim(), phone: typedPhone.trim() });
                setOther(false);
              }}
            >
              {ui("owner.itemsUseName", locale)}
            </Button>
          </div>
        </div>
      ) : null}

      <ItemTiles items={products} counts={counts} onChange={change} locale={locale} rateKnown={lbpPerUsd !== null} />

      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          {ui("dialog.close", locale)}
        </Button>
        <Button type="button" className="flex-1" disabled={itemCount === 0 || pending || !payer} onClick={add}>
          {ui("owner.addItems", locale)} <LtrIsolate>{formatParts(total, locale)}</LtrIsolate>
        </Button>
      </div>
    </div>
  );
}
