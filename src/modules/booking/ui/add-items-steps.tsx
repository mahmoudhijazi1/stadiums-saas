"use client";

import { useState } from "react";
import type Decimal from "decimal.js";
import { ArrowRight } from "lucide-react";
import { PartsBalance } from "@/modules/shop/ui/parts-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LbpInput } from "@/components/ui/lbp-input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import type { UiLocale } from "@/lib/locale";
import { formatParts } from "@/lib/format/money";
import { ui } from "@/lib/copy";
import { cn } from "cn";

/** What the items come to: pounds for the pound items, dollars for the dollar items. */
export type ItemParts = { lbp: Decimal; usd: Decimal };

/** Who can be charged: the booker, or someone who already has a tab on this game, or a new nickname. */
export type Payer =
  | { kind: "game" }
  | { kind: "person"; personId: string; name: string }
  | { kind: "name"; name: string; phone: string };

export const sameRef = (a: Payer, b: Payer): boolean =>
  a.kind === b.kind &&
  (a.kind === "game" ||
    (a.kind === "person" && b.kind === "person" && a.personId === b.personId) ||
    (a.kind === "name" && b.kind === "name" && a.name.toLowerCase() === b.name.toLowerCase()));

/** The server's payer, from the screen's: only ids and what was typed. */
export function payerInput(payer: Payer) {
  if (payer.kind === "game") return { kind: "game" as const };
  if (payer.kind === "person") return { kind: "person" as const, personId: payer.personId };
  return { kind: "name" as const, name: payer.name, ...(payer.phone ? { phone: payer.phone } : {}) };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="type-secondary text-owed">
      {error}
    </p>
  ) : null;
}

/** "Pay now": the usual collect screen, prefilled with exactly what the items come to. No name, no phone. */
export function PayNowStep({
  parts,
  lbpPerUsd,
  locale,
  pending,
  error,
  onPay,
}: {
  parts: ItemParts;
  lbpPerUsd: string | null;
  locale: UiLocale;
  pending: boolean;
  error: string | null;
  onPay: (usdAmount: string, lbpAmount: string) => void;
}) {
  const [usd, setUsd] = useState(parts.usd.gt(0) ? parts.usd.toFixed(2) : "");
  const [lbp, setLbp] = useState(parts.lbp.gt(0) ? parts.lbp.toFixed(0) : "");
  const totalText = formatParts(parts, locale);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="game-sale-lbp">{ui("owner.lbp", locale)}</Label>
        <LbpInput id="game-sale-lbp" value={lbp} onValueChange={setLbp} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="game-sale-usd">USD</Label>
        <Input id="game-sale-usd" inputMode="decimal" autoComplete="off" value={usd} onChange={(event) => setUsd(event.target.value)} />
      </div>
      <PartsBalance owed={parts} usdText={usd} lbpText={lbp} lbpPerUsd={lbpPerUsd} locale={locale} />
      <ErrorLine error={error} />
      <Button type="button" className="w-full" disabled={pending} onClick={() => onPay(usd, lbp)}>
        {ui("owner.collect", locale)} <LtrIsolate>{totalText}</LtrIsolate>
      </Button>
    </div>
  );
}

const chip = (selected: boolean) =>
  cn(
    "inline-flex min-h-12 max-w-full items-center rounded-full border px-5 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    selected ? "border-line bg-surface-2 text-ink shadow-sm" : "border-line text-muted-foreground",
  );

/**
 * "On a tab": one-tap buttons for the booker (selected) and for every payer that already has a tab on
 * this game, then "New". Choosing adds the items to that payer's tab; nothing is typed.
 */
export function TabStep({
  bookerName,
  others,
  payer,
  onPick,
  onNew,
  locale,
  pending,
  error,
  onAdd,
}: {
  bookerName: string;
  others: Payer[];
  payer: Payer;
  onPick: (payer: Payer) => void;
  onNew: () => void;
  locale: UiLocale;
  pending: boolean;
  error: string | null;
  onAdd: () => void;
}) {
  const chosenName = payer.kind === "game" ? bookerName : payer.name;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={ui("owner.itemsOnTab", locale)}>
        <button type="button" aria-pressed={payer.kind === "game"} className={chip(payer.kind === "game")} onClick={() => onPick({ kind: "game" })}>
          <bdi className="truncate">{bookerName}</bdi>
        </button>
        {others.map((other) => (
          <button
            key={other.kind === "person" ? other.personId : `n:${other.kind === "name" ? other.name.toLowerCase() : ""}`}
            type="button"
            aria-pressed={sameRef(payer, other)}
            className={chip(sameRef(payer, other))}
            onClick={() => onPick(other)}
          >
            <bdi className="truncate">{other.kind === "game" ? "" : other.name}</bdi>
          </button>
        ))}
        <button type="button" className={cn(chip(false), "text-action-ink")} onClick={onNew}>
          {ui("owner.itemsNew", locale)}
        </button>
      </div>
      <ErrorLine error={error} />
      <Button type="button" className="w-full" disabled={pending} onClick={onAdd}>
        <span className="min-w-0 truncate">{ui("owner.addWord", locale)}</span>
        <ArrowRight aria-hidden className="size-4 shrink-0 rtl:rotate-180" />
        <bdi className="min-w-0 truncate">{chosenName}</bdi>
      </Button>
    </div>
  );
}

/**
 * "New": one field, at the top and focused so the keyboard never covers it. The phone stays behind
 * "+ Phone" and is optional (a phone that belongs to a known person selects that person, as the server decides).
 */
export function NewTabStep({
  locale,
  pending,
  error,
  onAdd,
}: {
  locale: UiLocale;
  pending: boolean;
  error: string | null;
  onAdd: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [withPhone, setWithPhone] = useState(false);
  const [phone, setPhone] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={ui("owner.itemsNameOrNickname", locale)}
        aria-label={ui("owner.itemsNameOrNickname", locale)}
        autoComplete="off"
        autoFocus
      />
      {withPhone ? (
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
      )}
      <ErrorLine error={error} />
      <Button type="button" className="w-full" disabled={name.trim() === "" || pending} onClick={() => onAdd(name.trim(), phone.trim())}>
        {ui("owner.addWord", locale)}
      </Button>
    </div>
  );
}
