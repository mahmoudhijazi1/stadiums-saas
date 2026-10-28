"use client";

import { useState, type Ref } from "react";
import { useBrowserOrigin } from "@/lib/use-browser-origin";
import { CountedPhrase } from "@/modules/booking/ui/notify-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { formatPrice } from "@/lib/format/money";
import { ui, uiCount } from "@/lib/copy";
import { previewMessage } from "@/modules/notification/domain/whatsapp-link";
import Decimal from "decimal.js";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { AmountField, offUnit, typedAmount } from "@/modules/booking/ui/amount-field";
import { cn } from "cn";

/** The fee actions of the booking sheet: cancel, no-show and adjust due. */
export type FeeActions = {
  submitCancelBooking: (formData: FormData) => Promise<void>;
  submitRecordNoShow: (formData: FormData) => Promise<void>;
  submitAdjustBookingDue: (formData: FormData) => Promise<void>;
};

type FeeChoice = "PLAYER" | "OWNER";
type FeeMode = "shown" | "edit" | "waive";
type Currency = "USD" | "LBP";

/**
 * The fee screens work in the game's own currency (DR-007 slice 8). A row's fee, collected and due
 * strings are in it: dollars with cents ("7.50"), or whole pounds ("1000000"). Absent `currency` is USD.
 */
function currencyOf(row: UpcomingRowView): Currency {
  return row.currency ?? "USD";
}

/** An amount of the game's currency, written for a screen: "$15" or "1,000,000 LBP". */
function moneyText(currency: Currency, amount: string, locale: UiLocale): string {
  return formatPrice({ currency, amount }, locale);
}

/** The form field a fee or an amount is sent in: one per currency, so the server can tell them apart. */
const FEE_FIELD: Record<Currency, string> = { USD: "feeUsd", LBP: "feeLbp" };
const WAIVED_FEE: Record<Currency, string> = { USD: "0.00", LBP: "0" };

export function CancelDecisionForm({
  row,
  locale,
  date,
  mayAdjust,
  confirmRef,
  onBack,
  submitCancelBooking,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  mayAdjust: boolean;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  submitCancelBooking: (formData: FormData) => Promise<void>;
}) {
  const [initiator, setInitiator] = useState<FeeChoice>("PLAYER");
  const [mode, setMode] = useState<FeeMode>("shown");
  const compact =
    initiator === "PLAYER" ? row.playerFeeCompact : row.ownerFeeCompact;
  const exact = initiator === "PLAYER" ? row.playerFeeExact : row.ownerFeeExact;
  const [feeExact, setFeeExact] = useState(row.playerFeeExact);
  const publicUrl = useBrowserOrigin();
  // The editable fee follows the fee of the chosen initiator: reset it during render when that
  // changes (no effect, no extra paint).
  const [seenExact, setSeenExact] = useState(exact);
  if (seenExact !== exact) {
    setSeenExact(exact);
    setFeeExact(exact);
  }

  function choose(next: FeeChoice) {
    setInitiator(next);
    setMode("shown");
  }

  const message = cancelWhatsAppText({
    initiator,
    mode,
    exact,
    feeExact,
    row,
    locale,
    link: publicUrl,
  });
  const currency = currencyOf(row);

  return (
    <form action={submitCancelBooking} className="flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={row.id} />
      {date ? <input type="hidden" name="date" value={date} /> : null}
      <Choice
        name="initiator"
        value="PLAYER"
        checked={initiator === "PLAYER"}
        onChange={() => choose("PLAYER")}
        label={ui("owner.playerCancelled", locale)}
      />
      {mayAdjust || !row.ownerCancelLowersFee ? (
        <Choice
          name="initiator"
          value="OWNER"
          checked={initiator === "OWNER"}
          onChange={() => choose("OWNER")}
          label={ui("owner.ownerCancelled", locale)}
        />
      ) : null}
      <FeeLine
        locale={locale}
        currency={currency}
        compact={mode === "waive" ? "0" : compact}
        hoursBefore={row.hoursBefore}
        lead="cancel"
        mayAdjust={mayAdjust && compact !== null}
        mode={mode}
        exact={exact}
        collectedExact={row.collectedExact}
        collectedCompact={row.collectedCompact}
        onEdit={() => setMode("edit")}
        onWaive={() => setMode("waive")}
        onDraft={setFeeExact}
      />
      {message ? <p className="text-sm">{message}</p> : null}
      <SubmitButton ref={confirmRef} variant="destructive" className="w-full">
        {ui("owner.cancelConfirm", locale)}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </form>
  );
}

export function NoShowDecisionForm({
  row,
  locale,
  date,
  mayAdjust,
  confirmRef,
  onBack,
  submitRecordNoShow,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  mayAdjust: boolean;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  submitRecordNoShow: (formData: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<FeeMode>("shown");
  const [feeExact, setFeeExact] = useState(row.noShowFeeExact);
  const compact = mode === "waive" ? "0" : row.noShowFeeCompact;
  const message = noShowWhatsAppText({
    mode,
    exact: row.noShowFeeExact,
    feeExact,
    row,
    locale,
  });

  return (
    <form action={submitRecordNoShow} className="flex flex-col gap-3">
      <input type="hidden" name="bookingId" value={row.id} />
      {date ? <input type="hidden" name="date" value={date} /> : null}
      <FeeLine
        locale={locale}
        currency={currencyOf(row)}
        compact={compact}
        hoursBefore={row.hoursBefore}
        lead="noshow"
        mayAdjust={mayAdjust && row.noShowFeeCompact !== null}
        mode={mode}
        exact={row.noShowFeeExact}
        collectedExact={row.collectedExact}
        collectedCompact={row.collectedCompact}
        onEdit={() => setMode("edit")}
        onWaive={() => setMode("waive")}
        onDraft={setFeeExact}
      />
      {message ? <p className="text-sm">{message}</p> : null}
      <SubmitButton ref={confirmRef} className="w-full">
        {ui("owner.noShow", locale)}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </form>
  );
}

/**
 * "Adjust the amount": the current amount and what was paid so far in the game's currency, the new amount
 * with its currency beside it (digits grouped in pounds), the reason as chips with a filled selected state,
 * a live "Remaining will be X", and "Save new amount". An amount below what was collected is refused here
 * as before (no refund yet); pounds off the money unit show the unit error under the field.
 */
export function AdjustDueForm({
  row,
  locale,
  date,
  confirmRef,
  onBack,
  submitAdjustBookingDue,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
  submitAdjustBookingDue: (formData: FormData) => Promise<void>;
}) {
  const currency = currencyOf(row);
  const field = currency === "LBP" ? "toLbp" : "toUsd";
  const [amount, setAmount] = useState(row.priceUsd);
  const [reason, setReason] = useState<string | null>(null);
  const paid = new Decimal(row.collectedExact);
  const typed = typedAmount(currency, amount);
  const belowPaid = typed !== null && typed.lt(paid);
  const ready = typed !== null && !belowPaid && !offUnit(currency, amount) && reason !== null;
  const money = (value: Decimal | string) => moneyText(currency, value.toString(), locale);

  return (
    <form action={submitAdjustBookingDue} className="flex flex-col gap-4">
      <input type="hidden" name="bookingId" value={row.id} />
      {date ? <input type="hidden" name="date" value={date} /> : null}
      {reason ? <input type="hidden" name="reason" value={reason} /> : null}
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="type-secondary">{ui("owner.currentAmount", locale)}</dt>
        <dd className="type-strong">
          <LtrIsolate>{money(row.priceUsd)}</LtrIsolate>
        </dd>
        <dt className="type-secondary">{ui("owner.paidSoFar", locale)}</dt>
        <dd className="type-strong">
          <LtrIsolate>{money(row.collectedExact)}</LtrIsolate>
        </dd>
      </dl>
      <AmountField
        id={`due-${row.id}`}
        name={field}
        label={ui("owner.newDue", locale)}
        currency={currency}
        value={amount}
        onValueChange={setAmount}
        locale={locale}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{ui("owner.adjustDue", locale)}</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["DISCOUNT", "owner.reasonDiscount"],
              ["PARTIAL_GAME", "owner.reasonPartial"],
              ["WAIVER", "owner.reasonWaiver"],
              ["CORRECTION", "owner.reasonCorrection"],
            ] as const
          ).map(([value, key]) => (
            <ReasonChip key={value} selected={reason === value} onSelect={() => setReason(value)} label={ui(key, locale)} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`note-${row.id}`}>{ui("owner.noteOptional", locale)}</Label>
        <Input id={`note-${row.id}`} type="text" name="note" maxLength={200} />
      </div>
      <p aria-live="polite" className="type-label empty:hidden">
        {belowPaid ? (
          <span role="alert" className="text-alert">
            {ui("owner.collectedPrefix", locale)} <LtrIsolate>{moneyText(currency, row.collectedCompact, locale)}</LtrIsolate>
            {ui("owner.noRefundYet", locale)}
          </span>
        ) : typed !== null ? (
          <>
            {ui("owner.remainingWillBe", locale)} <LtrIsolate>{money(typed.minus(paid))}</LtrIsolate>
          </>
        ) : null}
      </p>
      <SubmitButton ref={confirmRef} className="w-full" disabled={!ready}>
        {ui("owner.saveNewAmount", locale)}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </form>
  );
}

function FeeLine({
  locale,
  currency,
  compact,
  hoursBefore,
  lead,
  mayAdjust,
  mode,
  exact,
  collectedExact,
  collectedCompact,
  onEdit,
  onWaive,
  onDraft,
}: {
  locale: UiLocale;
  currency: Currency;
  compact: string | null;
  hoursBefore: number;
  lead: "cancel" | "noshow";
  mayAdjust: boolean;
  mode: FeeMode;
  exact: string;
  collectedExact: string;
  collectedCompact: string;
  onEdit: () => void;
  onWaive: () => void;
  onDraft?: (value: string) => void;
}) {
  const [draft, setDraft] = useState(exact);
  if (compact === null) return null;
  const keepsCollected = feeKeepsCollected(currency, mode, draft, collectedExact);
  const leadText =
    lead === "noshow"
      ? ui("owner.noShowFeeLine", locale)
      : hoursBefore < 1
        ? ui("owner.cancelledUnderHour", locale)
        : uiCount("owner.hoursBefore", hoursBefore, locale);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {lead === "cancel" && hoursBefore >= 1 ? (
          <CountedPhrase text={leadText} />
        ) : (
          leadText
        )}
        <span aria-hidden> · </span>
        {ui("owner.feeWord", locale)}{" "}
        <LtrIsolate>{moneyText(currency, compact, locale)}</LtrIsolate>
      </p>
      {keepsCollected ? (
        <p className="text-muted-foreground">
          {locale === "en" ? (
            <>
              <LtrIsolate>{moneyText(currency, collectedCompact, locale)}</LtrIsolate>
              {ui("owner.collectedKeptTail", locale)}
            </>
          ) : (
            <>
              {ui("owner.collectedPrefix", locale)}{" "}
              <LtrIsolate>{moneyText(currency, collectedCompact, locale)}</LtrIsolate>
              {ui("owner.collectedKeptTail", locale)}
            </>
          )}
        </p>
      ) : null}
      {mode === "edit" ? (
        <AmountField
          id={`fee-${lead}`}
          name={FEE_FIELD[currency]}
          label={ui("owner.feeWord", locale)}
          currency={currency}
          value={draft}
          onValueChange={(value) => {
            setDraft(value);
            onDraft?.(value);
          }}
          locale={locale}
        />
      ) : null}
      {mode === "waive" ? <input type="hidden" name={FEE_FIELD[currency]} value={WAIVED_FEE[currency]} /> : null}
      {mayAdjust && mode === "shown" ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onEdit}>
            {ui("owner.editFee", locale)}
          </Button>
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onWaive}>
            {ui("owner.waiveFee", locale)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function feeKeepsCollected(currency: Currency, mode: FeeMode, draft: string, collectedExact: string): boolean {
  const collected = new Decimal(collectedExact);
  if (!collected.gt(0)) return false;
  if (mode === "waive") return true;
  if (mode !== "edit") return false;
  const typed = typedAmount(currency, draft);
  return typed !== null && !typed.gt(collected);
}

function Choice({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 has-[:checked]:bg-selected has-[:checked]:text-selected-ink">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="size-4"
        required
      />
      {label}
    </label>
  );
}

function ReasonChip({ selected, onSelect, label }: { selected: boolean; onSelect: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 type-label outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected ? "border-transparent bg-selected text-selected-ink" : "border-line-strong bg-surface text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function cancelWhatsAppText(input: {
  initiator: FeeChoice;
  mode: FeeMode;
  exact: string;
  feeExact: string;
  row: UpcomingRowView;
  locale: UiLocale;
  link: string;
}): string | null {
  const currency = currencyOf(input.row);
  const fee = chosenFee(currency, input.mode, input.exact, input.feeExact);
  return previewMessage({
    context: "after_cancel",
    facts: {
      name: input.row.requesterName,
      stadiumName: input.row.stadiumName,
      day: input.row.waDay,
      time: input.row.waTime,
      initiator: input.initiator === "OWNER" ? "OWNER" : "PLAYER",
      link: input.link,
      fee: fee.gt(0) ? formatPrice({ currency, amount: fee }, input.locale) : null,
    },
    locale: input.locale,
  });
}

function noShowWhatsAppText(input: {
  mode: FeeMode;
  exact: string;
  feeExact: string;
  row: UpcomingRowView;
  locale: UiLocale;
}): string | null {
  const currency = currencyOf(input.row);
  const fee = chosenFee(currency, input.mode, input.exact, input.feeExact);
  // A fee: the payment reminder. No fee: nothing to say, so no text is previewed.
  return previewMessage({
    context: "after_no_show",
    state: { feeCharged: fee.gt(0) },
    facts: {
      name: input.row.requesterName,
      stadiumName: input.row.stadiumName,
      day: input.row.waDay,
      time: input.row.waTime,
      amount: formatPrice({ currency, amount: fee }, input.locale),
    },
    locale: input.locale,
  });
}

/** The fee the message will name: waived is nothing, edited is what is typed, else the suggestion. */
function chosenFee(currency: Currency, mode: FeeMode, exact: string, feeExact: string): Decimal {
  if (mode === "waive") return new Decimal(0);
  return typedAmount(currency, mode === "edit" ? feeExact : exact) ?? typedAmount(currency, exact) ?? new Decimal(0);
}

