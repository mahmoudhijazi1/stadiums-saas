"use server";

import { redirect } from "next/navigation";
import { logger } from "@/lib/logger";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";

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
