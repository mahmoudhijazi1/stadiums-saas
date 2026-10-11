"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import {
  hasPublicRequestFieldErrors,
  publicRequestFieldErrors,
  type PublicRequestFieldErrors,
} from "@/modules/booking/domain/request-fields";
import {
  PUBLIC_REQUEST_ERROR_COPY,
  isFinalPublicRequestError,
  type PublicRequestErrorKind,
} from "@/modules/booking/domain/public-request-errors";
import { DEFAULT_COUNTRY } from "@/modules/people/domain/countries";
import { PhoneField } from "@/modules/people/ui/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClockText, IsolatedDigits } from "@/components/ui/ltr-isolate";
import type { SlotPickerSlot } from "@/modules/booking/ui/slot-picker";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";

export type PublicRequestState =
  | { step: "form"; error: PublicRequestErrorKind | null; pending: boolean }
  | { step: "sent" };

const LINK_BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 type-button outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The body of the request sheet, by state: the form, the "sent" confirmation, or a friendly error.
 * No sheet, no network: the wrapper owns both and passes `onSubmit` and `state`.
 */
export function PublicRequestView({
  state,
  pitchId,
  slot,
  dayLabel,
  dateValue,
  locale,
  cancelLine,
  feeLine,
  whatsappHref,
  onSubmit,
  onClose,
  onAnother,
}: {
  state: PublicRequestState;
  pitchId: string;
  slot: SlotPickerSlot;
  /** "Fri 16": the weekday and day number of the chosen day. */
  dayLabel: string;
  dateValue: string;
  locale: UiLocale;
  /** "Cancel up to 24 hours before", or null when the stadium has no such window. */
  cancelLine: string | null;
  /** The late-cancel fee line, or null when the fee is 0. */
  feeLine: string | null;
  /** A plain WhatsApp chat with the stadium, or null when no number is set. */
  whatsappHref: string | null;
  onSubmit: (formData: FormData) => void;
  onClose: () => void;
  onAnother: () => void;
}) {
  if (state.step === "sent") {
    const [before, after] = ui("public.sentFor", locale).split("{when}");
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="flex items-start gap-2 type-body">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-paid" />
          <span>
            {before}
            <IsolatedDigits text={dayLabel} /> <ClockText text={slot.startLocal} />
            {after}
          </span>
        </p>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
            <MessageCircle aria-hidden className="size-4" />
            {ui("public.whatsapp", locale)}
          </a>
        ) : null}
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onAnother}>
          {ui("public.requestAnother", locale)}
        </Button>
      </div>
    );
  }

  const error = state.error;
  if (error && isFinalPublicRequestError(error)) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="type-body">
          {ui(PUBLIC_REQUEST_ERROR_COPY[error], locale)}
        </p>
        <Button type="button" className="min-h-11 w-full" onClick={onClose}>
          {ui("public.pickAnother", locale)}
        </Button>
      </div>
    );
  }

  return (
    <RequestForm
      pitchId={pitchId}
      slot={slot}
      dateValue={dateValue}
      locale={locale}
      error={error}
      pending={state.pending}
      cancelLine={cancelLine}
      feeLine={feeLine}
      onSubmit={onSubmit}
    />
  );
}

function RequestForm({
  pitchId,
  slot,
  dateValue,
  locale,
  error,
  pending,
  cancelLine,
  feeLine,
  onSubmit,
}: {
  pitchId: string;
  slot: SlotPickerSlot;
  dateValue: string;
  locale: UiLocale;
  error: PublicRequestErrorKind | null;
  pending: boolean;
  cancelLine: string | null;
  feeLine: string | null;
  onSubmit: (formData: FormData) => void;
}) {
  const [fieldErrors, setFieldErrors] = useState<PublicRequestFieldErrors>({});
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = publicRequestFieldErrors(String(data.get("name") ?? ""), String(data.get("phone") ?? ""), country);
    if (hasPublicRequestFieldErrors(next)) {
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    onSubmit(data);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="pitchId" value={pitchId} />
      <input type="hidden" name="start" value={slot.startIso} />
      <input type="hidden" name="end" value={slot.endIso} />
      <input type="hidden" name="date" value={dateValue} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="request-name">{ui("public.name", locale)}</Label>
        <Input
          id="request-name"
          type="text"
          name="name"
          autoComplete="name"
          maxLength={60}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "request-name-err" : undefined}
          onInput={() => setFieldErrors((current) => ({ ...current, name: undefined }))}
        />
        {fieldErrors.name ? (
          <p id="request-name-err" role="alert" className="type-secondary text-destructive">
            {ui(fieldErrors.name, locale)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="request-phone">{ui("public.phone", locale)}</Label>
        <PhoneField
          locale={locale}
          country={country}
          onCountryChange={(code) => {
            setCountry(code);
            setFieldErrors((current) => ({ ...current, phone: undefined }));
          }}
          phoneId="request-phone"
          invalid={Boolean(fieldErrors.phone)}
          describedBy={fieldErrors.phone ? "request-phone-err" : undefined}
          onPhoneInput={() => setFieldErrors((current) => ({ ...current, phone: undefined }))}
        />
        {fieldErrors.phone ? (
          <p id="request-phone-err" role="alert" className="type-secondary text-destructive">
            {ui(fieldErrors.phone, locale)}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="type-secondary text-destructive">
          {ui(PUBLIC_REQUEST_ERROR_COPY[error], locale)}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "…" : ui("public.sendRequest", locale)}
      </Button>
      <p className="type-secondary">{ui("public.requestNote", locale)}</p>
      {cancelLine ? (
        <p className="type-secondary">
          <IsolatedDigits text={cancelLine} />
        </p>
      ) : null}
      {feeLine ? (
        <p className="type-secondary">
          <IsolatedDigits text={feeLine} />
        </p>
      ) : null}
    </form>
  );
}
