"use server";

import { parseUsd, parseLbp } from "@/lib/money";
import { actionErrorKey } from "@/lib/use-case-error";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { parseCollectPayment } from "@/modules/payment/schemas/collect-payment";
import { field, redirectOwner } from "@/app/owner/form-query";

const TODAY_KEEP = ["tenant"] as const;

/**
 * Thin Server Action (Next 16 forms.md: <form action> + FormData).
 * Zod → use case (auth lives there). redirect() outside try/catch (redirect.md).
 */
async function submitDecision(
  formData: FormData,
  decide: (bookingId: string) => Promise<void>,
  useCase: string,
  ok: string,
) {
  let errorKey: string | undefined;
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    await decide(parsed.bookingId);
  } catch (error) {
    errorKey = await actionErrorKey(error, useCase);
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, { ok });
}

export async function submitApproveBooking(formData: FormData) {
  await submitDecision(formData, approveBooking, "submitApproveBooking", "approved");
}

export async function submitRejectBooking(formData: FormData) {
  await submitDecision(formData, rejectBooking, "submitRejectBooking", "rejected");
}

export async function submitCancelBooking(formData: FormData) {
  await submitDecision(formData, cancelBooking, "submitCancelBooking", "cancelled");
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
