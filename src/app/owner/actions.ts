"use server";

import { redirect } from "next/navigation";
import { parseLbp, parseUsd } from "@/lib/money";
import { actionErrorKey } from "@/lib/use-case-error";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";
import { parseOwnerCreateBooking } from "@/modules/booking/schemas/owner-create-booking";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { parseCollectPayment } from "@/modules/payment/schemas/collect-payment";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";
import { recordExpense } from "@/modules/expense/application/record-expense";
import { parseRecordExpense } from "@/modules/expense/schemas/record-expense";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const KEEP_QUERY = [
  "tenant",
  "bookOn",
  "from",
  "to",
  "view",
  "displayRate",
] as const;

/**
 * Keep local query after POST (tenant, bookOn, period). Hidden tenant is not isolation.
 */
function ownerQuery(formData: FormData, extra?: Record<string, string>): string {
  const next = new URLSearchParams();
  for (const key of KEEP_QUERY) {
    const value = field(formData, key);
    if (value) next.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Thin Server Action (Next 16 forms.md: <form action> + FormData).
 * Zod → use case (auth lives there). redirect() outside try/catch (redirect.md).
 */
async function submitDecision(
  formData: FormData,
  decide: (bookingId: string) => Promise<void>,
  useCase: string,
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
    redirect(`/owner${ownerQuery(formData, { error: errorKey })}`);
  }
  redirect(`/owner${ownerQuery(formData)}`);
}

export async function submitApproveBooking(formData: FormData) {
  await submitDecision(formData, approveBooking, "submitApproveBooking");
}

export async function submitRejectBooking(formData: FormData) {
  await submitDecision(formData, rejectBooking, "submitRejectBooking");
}

export async function submitCancelBooking(formData: FormData) {
  await submitDecision(formData, cancelBooking, "submitCancelBooking");
}

/**
 * Thin owner Book action. Zod → createOwnerBooking.
 * redirect() outside try/catch (Next redirect docs). Keep bookOn on the query.
 */
export async function submitCreateOwnerBooking(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseOwnerCreateBooking({
      name: field(formData, "name"),
      phone: field(formData, "phone"),
      pitchId: field(formData, "pitchId"),
      start: field(formData, "start"),
      end: field(formData, "end"),
    });
    await createOwnerBooking(parsed);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCreateOwnerBooking");
  }
  if (errorKey) {
    redirect(`/owner${ownerQuery(formData, { error: errorKey })}`);
  }
  redirect(`/owner${ownerQuery(formData)}`);
}

/**
 * Thin collect action. Zod → drafts → collectBookingPayment.
 * redirect() outside try/catch (Next redirect docs).
 */
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
    redirect(`/owner${ownerQuery(formData, { error: errorKey })}`);
  }
  redirect(`/owner${ownerQuery(formData)}`);
}

/**
 * Thin set-rate action. OWNER check lives in the use case.
 */
export async function submitSetExchangeRate(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseExchangeRate({
      lbpPerUsd: field(formData, "lbpPerUsd"),
    });
    await setExchangeRate(parseLbp(parsed.lbpPerUsd));
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitSetExchangeRate");
  }
  if (errorKey) {
    redirect(`/owner${ownerQuery(formData, { error: errorKey })}`);
  }
  redirect(`/owner${ownerQuery(formData)}`);
}

/**
 * Thin record-expense action. Zod → drafts → recordExpense.
 * redirect() outside try/catch (Next redirect docs).
 */
export async function submitRecordExpense(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseRecordExpense({
      category: field(formData, "category"),
      description: field(formData, "description"),
      occurredOn: field(formData, "occurredOn"),
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
    await recordExpense({
      category: parsed.category,
      description: parsed.description,
      occurredOn: parsed.occurredOn,
      tenders,
    });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitRecordExpense");
  }
  if (errorKey) {
    redirect(`/owner${ownerQuery(formData, { error: errorKey })}`);
  }
  redirect(`/owner${ownerQuery(formData)}`);
}
