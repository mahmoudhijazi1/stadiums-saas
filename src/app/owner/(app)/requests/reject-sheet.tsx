"use client";

import { useState } from "react";
import { submitRejectBooking } from "@/app/owner/(app)/today/actions";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { UiLocale } from "@/lib/locale";
import { ui } from "@/lib/ui-copy";

const KINDS = [
  { value: "slot_taken", label: "owner.rejectReason.slotTaken" },
  { value: "pitch_closed", label: "owner.rejectReason.pitchClosed" },
  { value: "other", label: "owner.rejectReason.other" },
] as const;

/**
 * Reject opens a reason sheet. Confirm calls rejectBooking unchanged;
 * the reason is only for the WhatsApp text on the next screen.
 */
export function RejectRequestButton({
  bookingId,
  name,
  locale,
}: {
  bookingId: string;
  name: string;
  locale: UiLocale;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"] | "">("");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-w-0 flex-1"
        onClick={() => setOpen(true)}
      >
        {ui("owner.reject", locale)}
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent closeLabel={ui("dialog.close", locale)}>
          <BottomSheetHeader>
            <BottomSheetTitle>{ui("owner.rejectSheet", locale)}</BottomSheetTitle>
            <BottomSheetDescription>{name}</BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="pb-4">
            <form action={submitRejectBooking} className="flex flex-col gap-3">
              <input type="hidden" name="bookingId" value={bookingId} />
              {KINDS.map((choice) => (
                <label
                  key={choice.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 has-[:checked]:bg-selected has-[:checked]:text-selected-ink"
                >
                  <input
                    type="radio"
                    name="reasonKind"
                    value={choice.value}
                    checked={kind === choice.value}
                    onChange={() => setKind(choice.value)}
                    className="size-4"
                    required
                  />
                  {ui(choice.label, locale)}
                </label>
              ))}
              {kind === "other" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`reject-note-${bookingId}`}>
                    {ui("owner.rejectNote", locale)}
                  </Label>
                  <Input
                    id={`reject-note-${bookingId}`}
                    name="reasonNote"
                    required
                    maxLength={80}
                  />
                </div>
              ) : (
                <input type="hidden" name="reasonNote" value="" />
              )}
              <SubmitButton variant="destructive" className="w-full">
                {ui("owner.rejectConfirm", locale)}
              </SubmitButton>
            </form>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
