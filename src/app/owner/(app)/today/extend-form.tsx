"use client";

import { useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { errorMessage } from "@/lib/error-messages";
import type { UiLocale } from "@/lib/locale";
import { normalizeUsdForm } from "@/lib/money";
import { ui } from "@/lib/ui-copy";
import { submitExtendBooking } from "./extend-actions";

/**
 * What "Extend 30 min" would do for one game, prepared on the server (times in the stadium's clock
 * and the member's 12/24-hour setting). `null` on the row = the member has no bookings.extend, or
 * the game cannot be extended at all (ended, not confirmed, split per player).
 */
export type ExtendOfferView = {
  allowed: boolean;
  /** Why the button is disabled: "Next game at 6:00 PM", "Closes at 11:00 PM", "Max 3 hours". */
  disabledReason: string | null;
  /** The end the owner saw. Sent back so a double tap adds 30 minutes once. */
  expectedEndsAt: string;
  /** The range after the extension, formatted. */
  newRange: string;
  /** The suggested added price, "15.00". */
  addedPriceUsd: string;
  /** Pending requests inside the added time. */
  declineCount: number;
  /** bookings.adjust_due: may change the added amount. */
  mayEditPrice: boolean;
};

const MONEY = /^(?:0|[1-9]\d*)\.\d{2}$/;

/**
 * The confirm step: the new time, the added price (editable only with bookings.adjust_due), how
 * many requests will be declined, one primary Confirm. After success it shows the new range and
 * the new due; the page behind refreshes so Today, free hours and the live minutes follow.
 */
export function ExtendForm({
  bookingId,
  offer,
  locale,
  confirmRef,
  onBack,
}: {
  bookingId: string;
  offer: ExtendOfferView;
  locale: UiLocale;
  confirmRef: Ref<HTMLButtonElement>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(offer.addedPriceUsd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amountDueUsd: string; newRange: string } | null>(null);

  async function confirm() {
    const normalized = normalizeUsdForm(price.trim());
    if (offer.mayEditPrice && !MONEY.test(normalized)) {
      setError(errorMessage("form.invalid", locale));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await submitExtendBooking({
        bookingId,
        expectedEndsAt: offer.expectedEndsAt,
        ...(offer.mayEditPrice ? { addedPriceUsd: normalized } : {}),
      });
      if ("error" in result) {
        setError(errorMessage(result.error, locale));
        // The booking moved under us (another device, a double tap): show the fresh state.
        router.refresh();
        return;
      }
      // Keep the range of THIS extension: the refresh below hands the form the next offer.
      setDone({ amountDueUsd: result.amountDueUsd, newRange: offer.newRange });
      router.refresh();
    } catch {
      setError(errorMessage("error.generic", locale));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="type-strong">
          {ui("owner.extendDone", locale)}
        </p>
        <div className="flex flex-col gap-1">
          <span className="type-caption">{ui("owner.extendNewTime", locale)}</span>
          <LtrIsolate className="type-body">{done.newRange}</LtrIsolate>
        </div>
        <div className="flex flex-col gap-1">
          <span className="type-caption">{ui("owner.newDue", locale)}</span>
          <LtrIsolate className="type-body">${done.amountDueUsd}</LtrIsolate>
        </div>
        <Button type="button" ref={confirmRef} className="w-full" onClick={onBack}>
          {ui("dialog.close", locale)}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="type-caption">{ui("owner.extendNewTime", locale)}</span>
        <LtrIsolate className="type-body">{offer.newRange}</LtrIsolate>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`extend-${bookingId}`}>{ui("owner.extendAdded", locale)}</Label>
        {offer.mayEditPrice ? (
          <Input
            id={`extend-${bookingId}`}
            dir="ltr"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="font-mono"
          />
        ) : (
          <LtrIsolate className="type-body">${offer.addedPriceUsd}</LtrIsolate>
        )}
      </div>
      {offer.declineCount > 0 ? (
        <p role="status" className="type-secondary text-owed">
          {ui("owner.extendDeclines", locale).replace("{n}", String(offer.declineCount))}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="type-secondary text-owed">
          {error}
        </p>
      ) : null}
      <Button type="button" ref={confirmRef} className="w-full" disabled={busy} onClick={confirm}>
        {ui("owner.extendConfirm", locale)}
      </Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onBack}>
        {ui("owner.cancelBack", locale)}
      </Button>
    </div>
  );
}
