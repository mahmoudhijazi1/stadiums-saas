"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { parseLbp, parseUsd } from "@/lib/money";
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

function ownerQuery(tenant: string, extra?: Record<string, string>): string {
  const next = new URLSearchParams();
  if (tenant) next.set("tenant", tenant);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

const EXPECTED = new Set([
  "Not allowed",
  "Booking not found",
  "Only a pending request can be approved or rejected",
  "Only a confirmed booking can be cancelled",
  "Slot no longer available",
]);

/**
 * Thin Server Action (Next 16 forms.md: <form action> + FormData).
 * Zod → use case (auth lives there). redirect() outside try/catch (redirect.md).
 */
async function submitDecision(
  formData: FormData,
  decide: (bookingId: string) => Promise<void>,
) {
  const tenant = field(formData, "tenant");
  const bookOn = field(formData, "bookOn");
  const extra: Record<string, string> = {};
  if (bookOn) extra.bookOn = bookOn;
  let failed = false;
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    await decide(parsed.bookingId);
  } catch (error) {
    const expected = error instanceof Error && EXPECTED.has(error.message);
    if (!expected) {
      logger.error("Booking decision failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(`/owner${ownerQuery(tenant, { ...extra, error: "1" })}`);
  }
  redirect(`/owner${ownerQuery(tenant, extra)}`);
}

export async function submitApproveBooking(formData: FormData) {
  await submitDecision(formData, approveBooking);
}

export async function submitRejectBooking(formData: FormData) {
  await submitDecision(formData, rejectBooking);
}

export async function submitCancelBooking(formData: FormData) {
  await submitDecision(formData, cancelBooking);
}

const CREATE_EXPECTED = new Set([
  "Not allowed",
  "Pitch not found",
  "Slot is not offered",
  "Slot is taken",
  "Slot has already ended",
  "Slot no longer available",
  "Requester not found",
]);

/**
 * Thin owner Book action. Zod → createOwnerBooking.
 * redirect() outside try/catch (Next redirect docs). Keep bookOn on the query.
 */
export async function submitCreateOwnerBooking(formData: FormData) {
  const tenant = field(formData, "tenant");
  const bookOn = field(formData, "bookOn");
  const extra: Record<string, string> = {};
  if (bookOn) extra.bookOn = bookOn;
  let failed = false;
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
    const expected =
      error instanceof ZodError ||
      (error instanceof Error && CREATE_EXPECTED.has(error.message));
    if (!expected) {
      logger.error("Owner booking failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(
      `/owner${ownerQuery(tenant, { ...extra, error: "1" })}`,
    );
  }
  redirect(`/owner${ownerQuery(tenant, extra)}`);
}

const COLLECT_EXPECTED = new Set([
  "Not allowed",
  "Booking not found",
  "Only an approved booking can be collected",
  "Nothing due",
  "Set exchange rate first",
  "Amount required",
  "Amount must be positive",
]);

/**
 * Thin collect action. Zod → drafts → collectBookingPayment.
 * redirect() outside try/catch (Next redirect docs).
 */
export async function submitCollectPayment(formData: FormData) {
  const tenant = field(formData, "tenant");
  let failed = false;
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
    const expected =
      error instanceof ZodError ||
      (error instanceof Error && COLLECT_EXPECTED.has(error.message));
    if (!expected) {
      logger.error("Collect payment failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(`/owner${ownerQuery(tenant, { error: "1" })}`);
  }
  redirect(`/owner${ownerQuery(tenant)}`);
}

/**
 * Thin set-rate action. OWNER check lives in the use case.
 */
export async function submitSetExchangeRate(formData: FormData) {
  const tenant = field(formData, "tenant");
  let failed = false;
  try {
    const parsed = parseExchangeRate({
      lbpPerUsd: field(formData, "lbpPerUsd"),
    });
    await setExchangeRate(parseLbp(parsed.lbpPerUsd));
  } catch (error) {
    const expected =
      error instanceof ZodError ||
      (error instanceof Error && error.message === "Not allowed");
    if (!expected) {
      logger.error("Set exchange rate failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(`/owner${ownerQuery(tenant, { error: "1" })}`);
  }
  redirect(`/owner${ownerQuery(tenant)}`);
}

const EXPENSE_EXPECTED = new Set([
  "Not allowed",
  "Set exchange rate first",
  "Amount required",
  "Amount must be positive",
]);

/**
 * Thin record-expense action. Zod → drafts → recordExpense.
 * redirect() outside try/catch (Next redirect docs).
 */
export async function submitRecordExpense(formData: FormData) {
  const tenant = field(formData, "tenant");
  let failed = false;
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
    const expected =
      error instanceof ZodError ||
      (error instanceof Error &&
        (EXPENSE_EXPECTED.has(error.message) ||
          error.message.startsWith("Invalid expense date")));
    if (!expected) {
      logger.error("Record expense failed", error);
    }
    failed = true;
  }
  if (failed) {
    redirect(`/owner${ownerQuery(tenant, { error: "1" })}`);
  }
  redirect(`/owner${ownerQuery(tenant)}`);
}
