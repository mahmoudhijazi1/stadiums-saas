"use client";

import { useState, useTransition } from "react";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { ClockRangeText, IsolatedDigits } from "@/components/ui/ltr-isolate";
import { clockRangeFromLocals } from "@/lib/format/time";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/copy";
import { publicRequestErrorKind } from "@/modules/booking/domain/public-request-errors";
import { PublicRequestView, type PublicRequestState } from "@/modules/booking/ui/public-request-view";
import type { SlotPickerSlot } from "@/modules/booking/ui/slot-picker";

/** What the page's Server Action answers: it never redirects, so the sheet can show the outcome. */
export type PublicRequestResult = { ok: true } | { ok: false; errorKey: string };
export type PublicRequestAction = (formData: FormData) => Promise<PublicRequestResult>;

export type PickedTime = { pitchId: string; pitchName: string | null; slot: SlotPickerSlot };

/**
 * The sheet a tapped time opens: day and time, name and phone, one primary button, the "request,
 * not a confirmation" line and the cancellation rule. After a send it turns into the confirmation.
 * The Server Action is a prop; the parent keeps only which time is picked.
 */
export function PublicRequestSheet({
  picked,
  onClose,
  action,
  dayLabel,
  dateValue,
  locale,
  cancelLine,
  feeLine,
  whatsappHref,
}: {
  picked: PickedTime | null;
  onClose: () => void;
  action: PublicRequestAction;
  dayLabel: string;
  dateValue: string;
  locale: UiLocale;
  cancelLine: string | null;
  feeLine: string | null;
  whatsappHref: string | null;
}) {
  return (
    <BottomSheet
      open={picked !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {picked ? (
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          {/* key: a new time starts from a clean form */}
          <SheetContent
            key={picked.slot.startIso + picked.pitchId}
            picked={picked}
            onClose={onClose}
            action={action}
            dayLabel={dayLabel}
            dateValue={dateValue}
            locale={locale}
            cancelLine={cancelLine}
            feeLine={feeLine}
            whatsappHref={whatsappHref}
          />
        </BottomSheetContent>
      ) : null}
    </BottomSheet>
  );
}

function SheetContent({
  picked,
  onClose,
  action,
  dayLabel,
  dateValue,
  locale,
  cancelLine,
  feeLine,
  whatsappHref,
}: Omit<Parameters<typeof PublicRequestSheet>[0], "picked"> & { picked: PickedTime }) {
  const [state, setState] = useState<PublicRequestState>({ step: "form", error: null, pending: false });
  const [, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState({ step: "form", error: null, pending: true });
    startTransition(async () => {
      try {
        const result = await action(formData);
        setState(
          result.ok
            ? { step: "sent" }
            : { step: "form", error: publicRequestErrorKind(result.errorKey), pending: false },
        );
      } catch {
        setState({ step: "form", error: "other", pending: false });
      }
    });
  }

  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle className="type-title">
          <IsolatedDigits text={dayLabel} />
          {" · "}
          <ClockRangeText text={clockRangeFromLocals(picked.slot.startLocal, picked.slot.endLocal)} />
        </BottomSheetTitle>
        <BottomSheetDescription>{picked.pitchName}</BottomSheetDescription>
      </BottomSheetHeader>
      <BottomSheetBody>
        <PublicRequestView
          state={state}
          pitchId={picked.pitchId}
          slot={picked.slot}
          dayLabel={dayLabel}
          dateValue={dateValue}
          locale={locale}
          cancelLine={cancelLine}
          feeLine={feeLine}
          whatsappHref={whatsappHref}
          onSubmit={submit}
          onClose={onClose}
          onAnother={onClose}
        />
      </BottomSheetBody>
    </>
  );
}
