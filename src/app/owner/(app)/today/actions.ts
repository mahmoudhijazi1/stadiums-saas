"use server";

import { DomainError } from "@/lib/errors";
import { getUiLocale } from "@/lib/get-ui-locale";
import { rejectReasonText } from "@/lib/ui-copy";
import { normalizeUsdForm, parseLbp, parseUsd } from "@/lib/money";
import { actionErrorKey } from "@/lib/use-case-error";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import { parseAdjustDueForm } from "@/modules/booking/schemas/adjust-due-form";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { parseCollectPayment } from "@/modules/payment/schemas/collect-payment";
import { field, redirectOwner } from "@/app/owner/form-query";

const TODAY_KEEP = ["date"] as const;

/**
 * Thin Server Action (Next 16 forms.md: <form action> + FormData).
 * Zod → use case (auth lives there). redirect() outside try/catch (redirect.md).
 * Approve and reject land on Requests so the notify sheet can open.
 */
export async function submitApproveBooking(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  let siblings = "";
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    bookingId = parsed.bookingId;
    const rejected = await approveBooking(parsed.bookingId);
    siblings = rejected.map((person) => person.personId).join(",");
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitApproveBooking");
  }
  if (errorKey) {
    redirectOwner("/owner/requests", formData, [], { error: errorKey });
  }
  redirectOwner("/owner/requests", formData, [], {
    notify: "approved",
    bookingId,
    siblings,
  });
}

export async function submitRejectBooking(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  let reason = "";
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    bookingId = parsed.bookingId;
    const locale = await getUiLocale();
    const text = rejectReasonText(
      field(formData, "reasonKind"),
      field(formData, "reasonNote"),
      locale,
    );
    if (!text) throw new DomainError("form.invalid");
    reason = text;
    await rejectBooking(parsed.bookingId);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitRejectBooking");
  }
  if (errorKey) {
    redirectOwner("/owner/requests", formData, [], { error: errorKey });
  }
  redirectOwner("/owner/requests", formData, [], {
    notify: "rejected",
    bookingId,
    reason,
  });
}

export async function submitCancelBooking(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  let ok = "cancelled";
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    bookingId = parsed.bookingId;
    const initiator = field(formData, "initiator");
    if (initiator !== "PLAYER" && initiator !== "OWNER") {
      throw new DomainError("form.invalid");
    }
    const cancelled = await cancelBooking({
      bookingId: parsed.bookingId,
      initiator,
      feeUsd: optionalFee(formData),
    });
    const waiting = peopleWaitingOn(
      await listOpenWaitlist(),
      cancelled,
      cancelled.requesterPersonId,
    );
    if (waiting.length === 0) ok = "slot_empty";
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCancelBooking");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, {
    ok,
    notify: "cancelled",
    bookingId,
  });
}

export async function submitRecordNoShow(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    bookingId = parsed.bookingId;
    await recordNoShow({
      bookingId: parsed.bookingId,
      feeUsd: optionalFee(formData),
    });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitRecordNoShow");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, {
    ok: "no_show",
    notify: "no_show",
    bookingId,
  });
}

export async function submitAdjustBookingDue(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  try {
    const parsed = parseAdjustDueForm({
      bookingId: field(formData, "bookingId"),
      toUsd: field(formData, "toUsd"),
      reason: field(formData, "reason"),
      note: field(formData, "note"),
    });
    bookingId = parsed.bookingId;
    await adjustBookingDue({
      bookingId: parsed.bookingId,
      toUsd: parseUsd(parsed.toUsd),
      reason: parsed.reason,
      note: parsed.note,
    });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitAdjustBookingDue");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, {
    ok: "due_adjusted",
    notify: "due",
    bookingId,
  });
}

function optionalFee(formData: FormData) {
  const raw = field(formData, "feeUsd").trim();
  if (!raw) return undefined;
  return parseUsd(normalizeUsdForm(raw));
}

export async function submitCollectPayment(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseCollectPayment({
      bookingId: field(formData, "bookingId"),
      usdAmount: field(formData, "usdAmount"),
      lbpAmount: field(formData, "lbpAmount"),
    });
    const tenders: TenderDraft[] = [];
    if (parsed.usdAmount) {
      tenders.push({ currency: "USD", amount: parseUsd(parsed.usdAmount) });
    }
    if (parsed.lbpAmount) {
      tenders.push({ currency: "LBP", amount: parseLbp(parsed.lbpAmount) });
    }
    await collectBookingPayment({ bookingId: parsed.bookingId, tenders });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCollectPayment");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, { ok: "collected" });
}
