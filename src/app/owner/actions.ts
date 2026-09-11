"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { parseLbp, parseUsd } from "@/lib/money";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { parseCollectPayment } from "@/modules/payment/schemas/collect-payment";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";

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
  "Slot no longer available",
]);

/**
 * Thin Server Action (Next 16 forms guide: <form action> + FormData).
 * Zod → use case (auth lives there). redirect() outside try/catch.
 */
async function submitDecision(
  formData: FormData,
  decide: (bookingId: string) => Promise<void>,
) {
  const tenant = field(formData, "tenant");
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
    redirect(`/owner${ownerQuery(tenant, { error: "1" })}`);
  }
  redirect(`/owner${ownerQuery(tenant)}`);
}

export async function submitApproveBooking(formData: FormData) {
  await submitDecision(formData, approveBooking);
}

export async function submitRejectBooking(formData: FormData) {
  await submitDecision(formData, rejectBooking);
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
