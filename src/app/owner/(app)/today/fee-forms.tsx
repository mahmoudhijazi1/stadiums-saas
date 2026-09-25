"use client";

import { useEffect, useState, type FormEvent, type Ref } from "react";
import { CountedPhrase } from "@/app/owner/notify-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { formatUsdCompact, normalizeUsdForm, parseUsd } from "@/lib/money";
import { ui, uiCount } from "@/lib/ui-copy";
import {
  bookingCancelledByOwnerMessage,
  bookingCancelledByPlayerFeeMessage,
  bookingCancelledByPlayerMessage,
  bookingNoShowFeeMessage,
  bookingNoShowMessage,
} from "@/modules/notification/domain/whatsapp-link";
import Decimal from "decimal.js";
import {
  submitAdjustBookingDue,
  submitCancelBooking,
  submitRecordNoShow,
} from "./actions";
import type { UpcomingRowView } from "./upcoming-panel";

type FeeChoice = "PLAYER" | "OWNER";
type FeeMode = "shown" | "edit" | "waive";

export function CancelDecisionForm({
  row,
  locale,
  date,
  mayAdjust,
  confirmRef,
  onBack,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  mayAdjust: boolean;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
}) {
  const [initiator, setInitiator] = useState<FeeChoice>("PLAYER");
  const [mode, setMode] = useState<FeeMode>("shown");
  const compact =
    initiator === "PLAYER" ? row.playerFeeCompact : row.ownerFeeCompact;
  const exact = initiator === "PLAYER" ? row.playerFeeExact : row.ownerFeeExact;
  const [feeExact, setFeeExact] = useState(row.playerFeeExact);
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    setFeeExact(exact);
  }, [exact]);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/`);
  }, []);

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
      <Choice
        name="initiator"
        value="OWNER"
        checked={initiator === "OWNER"}
        onChange={() => choose("OWNER")}
        label={ui("owner.ownerCancelled", locale)}
      />
      <FeeLine
        locale={locale}
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
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  mayAdjust: boolean;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
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

export function AdjustDueForm({
  row,
  locale,
  date,
  confirmRef,
  onBack,
}: {
  row: UpcomingRowView;
  locale: UiLocale;
  date?: string;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
}) {
  const [blocked, setBlocked] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const raw = String(new FormData(event.currentTarget).get("toUsd") ?? "");
    const normalized = normalizeUsdForm(raw.trim());
    if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(normalized)) {
      setBlocked(false);
      return;
    }
    if (parseUsd(normalized).lt(parseUsd(row.collectedExact))) {
      event.preventDefault();
      setBlocked(true);
      return;
    }
    setBlocked(false);
  }

  return (
    <form action={submitAdjustBookingDue} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <input type="hidden" name="bookingId" value={row.id} />
      {date ? <input type="hidden" name="date" value={date} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`due-${row.id}`}>{ui("owner.newDue", locale)}</Label>
        <Input
          id={`due-${row.id}`}
          dir="ltr"
          type="text"
          name="toUsd"
          required
          inputMode="decimal"
          defaultValue={row.priceUsd}
          className="font-mono"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{ui("owner.adjustDue", locale)}</legend>
        <div className="flex flex-wrap gap-2">
          <Reason name="reason" value="DISCOUNT" label={ui("owner.reasonDiscount", locale)} />
          <Reason name="reason" value="PARTIAL_GAME" label={ui("owner.reasonPartial", locale)} />
          <Reason name="reason" value="WAIVER" label={ui("owner.reasonWaiver", locale)} />
          <Reason name="reason" value="CORRECTION" label={ui("owner.reasonCorrection", locale)} />
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`note-${row.id}`}>{ui("owner.noteOptional", locale)}</Label>
        <Input id={`note-${row.id}`} type="text" name="note" maxLength={200} />
      </div>
      {blocked ? (
        <p role="alert" className="text-sm text-alert">
          {ui("owner.collectedPrefix", locale)}{" "}
          <LtrIsolate>${row.collectedCompact}</LtrIsolate>
          {ui("owner.noRefundYet", locale)}
        </p>
      ) : null}
      <SubmitButton ref={confirmRef} className="w-full">
        {ui("owner.saveRules", locale)}
      </SubmitButton>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </form>
  );
}

function FeeLine({
  locale,
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
  const keepsCollected = feeKeepsCollected(mode, draft, collectedExact);
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
        <LtrIsolate>${compact}</LtrIsolate>
      </p>
      {keepsCollected ? (
        <p className="text-muted-foreground">
          {locale === "en" ? (
            <>
              <LtrIsolate>${collectedCompact}</LtrIsolate>
              {ui("owner.collectedKeptTail", locale)}
            </>
          ) : (
            <>
              {ui("owner.collectedPrefix", locale)}{" "}
              <LtrIsolate>${collectedCompact}</LtrIsolate>
              {ui("owner.collectedKeptTail", locale)}
            </>
          )}
        </p>
      ) : null}
      {mode === "edit" ? (
        <Input
          dir="ltr"
          type="text"
          name="feeUsd"
          required
          inputMode="decimal"
          defaultValue={exact}
          onChange={(event) => {
            setDraft(event.target.value);
            onDraft?.(event.target.value);
          }}
          className="font-mono"
        />
      ) : null}
      {mode === "waive" ? <input type="hidden" name="feeUsd" value="0.00" /> : null}
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

function feeKeepsCollected(mode: FeeMode, draft: string, collectedExact: string): boolean {
  const collected = parseUsd(collectedExact);
  if (!collected.gt(0)) return false;
  if (mode === "waive") return true;
  if (mode !== "edit") return false;
  const normalized = normalizeUsdForm(draft.trim());
  if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(normalized)) return false;
  return !parseUsd(normalized).gt(collected);
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

function Reason({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center rounded-full border px-3 has-[:checked]:bg-selected has-[:checked]:text-selected-ink">
      <input type="radio" name={name} value={value} className="sr-only" required />
      {label}
    </label>
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
}): string {
  const shared = {
    name: input.row.requesterName,
    day: input.row.waDay,
    time: input.row.waTime,
    locale: input.locale,
  };
  if (input.initiator === "OWNER") {
    return bookingCancelledByOwnerMessage({ ...shared, link: input.link });
  }
  const fee = cancelFeeUsd(input.mode, input.exact, input.feeExact);
  if (fee.gt(0)) {
    return bookingCancelledByPlayerFeeMessage({
      ...shared,
      fee: `$${formatUsdCompact(fee)}`,
    });
  }
  return bookingCancelledByPlayerMessage(shared);
}

function noShowWhatsAppText(input: {
  mode: FeeMode;
  exact: string;
  feeExact: string;
  row: UpcomingRowView;
  locale: UiLocale;
}): string {
  const shared = {
    name: input.row.requesterName,
    day: input.row.waDay,
    time: input.row.waTime,
    locale: input.locale,
  };
  const fee = cancelFeeUsd(input.mode, input.exact, input.feeExact);
  if (fee.gt(0)) {
    return bookingNoShowFeeMessage({
      ...shared,
      fee: `$${formatUsdCompact(fee)}`,
    });
  }
  return bookingNoShowMessage(shared);
}

function cancelFeeUsd(mode: FeeMode, exact: string, feeExact: string): Decimal {
  if (mode === "waive") return new Decimal(0);
  const raw = mode === "edit" ? feeExact : exact;
  const normalized = normalizeUsdForm(raw.trim());
  if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(normalized)) return parseUsd(exact);
  return parseUsd(normalized);
}

