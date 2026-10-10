"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ItemTiles, QTY_MAX, partsOf, type SellItem } from "@/app/owner/item-tiles";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { formatParts } from "@/lib/format/money";
import { addNewLabel, itemsAddedToast, ui } from "@/lib/ui-copy";
import { cn } from "cn";
import { searchPayers, submitAddBookingItems, type PayerHit } from "./items-actions";

/** Who already has a tab on this booking (the booker's included, if she has one). */
export type TabPayer = { personId: string | null; name: string };

type Payer =
  | { kind: "game" }
  | { kind: "person"; personId: string; name: string }
  | { kind: "name"; name: string; phone: string };

const SEARCH_DELAY_MS = 250;

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

/** A number typed where a name goes: digits (and the usual separators) only, at least 6 of them. */
function looksLikePhone(text: string): boolean {
  return /^[\d\s+()-]+$/.test(text) && text.replace(/\D/g, "").length >= 6;
}

const sameRef = (a: Payer, b: Payer): boolean =>
  a.kind === b.kind &&
  (a.kind === "game" ||
    (a.kind === "person" && b.kind === "person" && a.personId === b.personId) ||
    (a.kind === "name" && b.kind === "name" && a.name.toLowerCase() === b.name.toLowerCase()));

/**
 * "+ Add" on a booking: a sheet of its own. At the top "Charge to": the booker, then every payer
 * that already has a tab on this game, then "+ Someone else" (one field, "Name or phone", with live
 * suggestions from the person search and a last suggestion to add the typed text as new; a phone that
 * belongs to a person selects that person, as the server decides). Below, the item tiles as in Sell.
 * One primary button whose label says how many, how much (in the currency of the items) and to whom.
 * Prices never come from here: only ids and quantities go to the server.
 */
export function AddItemsSheet({
  open,
  onClose,
  bookingId,
  bookerName,
  tabPayers,
  bookerPersonId,
  products,
  lbpPerUsd,
  locale,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  bookerName: string;
  bookerPersonId: string;
  tabPayers: TabPayer[];
  products: SellItem[];
  lbpPerUsd: string | null;
  locale: UiLocale;
  onDone: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [payer, setPayer] = useState<Payer>({ kind: "game" });
  const [someoneElse, setSomeoneElse] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PayerHit[]>([]);
  const [withPhone, setWithPhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchSeq = useRef(0);

  // The last choice for this booking is remembered; the booker is the default.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setPayer(loadPayer(bookingId) ?? { kind: "game" }), 0);
    return () => clearTimeout(timer);
  }, [open, bookingId]);

  // Live suggestions, debounced. Only the newest answer is kept.
  useEffect(() => {
    const text = query.trim();
    const seq = (searchSeq.current += 1);
    const timer = setTimeout(async () => {
      if (text === "") {
        setHits([]);
        return;
      }
      const result = await searchPayers(text);
      if (seq !== searchSeq.current) return;
      if ("error" in result) setError(errorMessage(result.error, locale));
      else setHits(result.hits);
    }, text === "" ? 0 : SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, locale]);

  const itemCount = products.reduce((sum, item) => sum + (counts[item.id] ?? 0), 0);
  const total = partsOf(products, counts);

  // Booker first, then the others who have a tab (the booker's own tab is the first chip).
  const others: Payer[] = tabPayers
    .filter((tab) => tab.personId === null || tab.personId !== bookerPersonId)
    .map((tab) =>
      tab.personId
        ? ({ kind: "person", personId: tab.personId, name: tab.name } as const)
        : ({ kind: "name", name: tab.name, phone: "" } as const),
    );
  const chosenIsExtra = !sameRef(payer, { kind: "game" }) && !others.some((other) => sameRef(other, payer));
  const payerName =
    payer.kind === "game" ? bookerName : payer.kind === "person" || payer.kind === "name" ? payer.name : "";

  function change(id: string, delta: number) {
    setCounts((current) => ({ ...current, [id]: Math.min(QTY_MAX, Math.max(0, (current[id] ?? 0) + delta)) }));
  }

  function choose(next: Payer) {
    setPayer(next);
    savePayer(bookingId, next);
    setError(null);
  }

  function pickHit(hit: PayerHit) {
    choose({ kind: "person", personId: hit.id, name: hit.name });
    setSomeoneElse(false);
    setQuery("");
    setHits([]);
  }

  function addTyped() {
    const text = query.trim();
    if (text === "") return;
    // A number typed in the name field is the phone: the server selects the person it belongs to.
    choose(looksLikePhone(text) ? { kind: "name", name: text, phone: text } : { kind: "name", name: text, phone: phone.trim() });
    setSomeoneElse(false);
    setQuery("");
    setHits([]);
    setPhone("");
    setWithPhone(false);
  }

  function add() {
    setError(null);
    const lines = products.filter((item) => (counts[item.id] ?? 0) > 0).map((item) => ({ productId: item.id, qty: counts[item.id]! }));
    startTransition(async () => {
      const result = await submitAddBookingItems({
        bookingId,
        lines,
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
      onClose();
      onDone();
    });
  }

  // The raised-surface pill of the tab bar for the chosen payer; the others are muted.
  const chip = (selected: boolean) =>
    cn(
      "inline-flex min-h-11 max-w-full items-center rounded-full border px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      selected ? "border-line bg-surface-2 text-ink shadow-sm" : "border-transparent text-muted-foreground",
    );

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
        <BottomSheetHeader>
          <BottomSheetTitle>{ui("owner.addItems", locale)}</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col gap-4 pb-4 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-2">
            <p className="type-section">{ui("owner.itemsChargeTo", locale)}</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label={ui("owner.itemsChargeTo", locale)}>
              <button type="button" aria-pressed={payer.kind === "game"} className={chip(payer.kind === "game")} onClick={() => choose({ kind: "game" })}>
                <span className="truncate">{ui("owner.itemsOnGame", locale)}</span>
              </button>
              {others.map((other) => (
                <button
                  key={other.kind === "person" ? other.personId : `n:${other.kind === "name" ? other.name.toLowerCase() : ""}`}
                  type="button"
                  aria-pressed={sameRef(payer, other)}
                  className={chip(sameRef(payer, other))}
                  onClick={() => choose(other)}
                >
                  <bdi className="truncate">{other.kind === "game" ? "" : other.name}</bdi>
                </button>
              ))}
              {chosenIsExtra && payer.kind !== "game" ? (
                <button type="button" aria-pressed className={chip(true)} onClick={() => setSomeoneElse(true)}>
                  <bdi className="truncate">{payer.name}</bdi>
                </button>
              ) : null}
              <button
                type="button"
                aria-expanded={someoneElse}
                className={chip(someoneElse)}
                onClick={() => setSomeoneElse((value) => !value)}
              >
                {ui("owner.itemsSomeoneElse", locale)}
              </button>
            </div>
          </div>

          {someoneElse ? (
            <div className="flex flex-col gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={ui("owner.itemsNameOrPhone", locale)}
                aria-label={ui("owner.itemsNameOrPhone", locale)}
                autoComplete="off"
                autoFocus
              />
              {query.trim() !== "" ? (
                <ul className="flex flex-col overflow-hidden rounded-xl border">
                  {hits.map((hit) => (
                    <li key={hit.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => pickHit(hit)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-start outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                      >
                        <span className="type-body min-w-0 truncate">
                          <bdi>{hit.name}</bdi>
                        </span>
                        {hit.phone ? (
                          <span className="type-secondary shrink-0">
                            <LtrIsolate>{hit.phone}</LtrIsolate>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={addTyped}
                      className="flex min-h-11 w-full items-center px-3 text-start type-label text-action-ink outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
                    >
                      <bdi>{addNewLabel(query.trim(), locale)}</bdi>
                    </button>
                  </li>
                </ul>
              ) : null}
              {!looksLikePhone(query.trim()) ? (
                withPhone ? (
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={ui("owner.itemsPhoneField", locale)}
                    aria-label={ui("owner.itemsPhoneField", locale)}
                    inputMode="tel"
                    autoComplete="off"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setWithPhone(true)}
                    className="inline-flex min-h-11 w-fit items-center type-label text-action-ink underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {ui("owner.itemsPlusPhone", locale)}
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          <ItemTiles items={products} counts={counts} onChange={change} locale={locale} rateKnown={lbpPerUsd !== null} />

          {error ? (
            <p role="alert" className="type-secondary text-owed">
              {error}
            </p>
          ) : null}
        </BottomSheetBody>
        <div className="shrink-0 px-4 pt-3">
          <Button type="button" className="w-full" disabled={itemCount === 0 || pending} onClick={add}>
            <span className="min-w-0 truncate">
              {ui("owner.addWord", locale)} <LtrIsolate>{itemCount}</LtrIsolate> · <LtrIsolate>{formatParts(total, locale)}</LtrIsolate>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
            <bdi className="min-w-0 truncate">{payerName}</bdi>
          </Button>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
