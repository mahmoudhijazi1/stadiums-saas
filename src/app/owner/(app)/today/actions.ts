"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { DomainError } from "@/lib/errors";
import { getUiLocale } from "@/lib/get-ui-locale";
import { rejectReasonText } from "@/lib/copy";
import { isLbpString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/format/parse-money";
import { actionErrorKey } from "@/lib/use-case-error";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { dismissMissedRequests } from "@/modules/booking/application/dismiss-missed-requests";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { considerGamePaid } from "@/modules/booking/application/consider-game-paid";
import { considerSharePaid } from "@/modules/booking/application/consider-share-paid";
import {
  collectAllRemaining,
  collectSlotPayment,
} from "@/modules/booking/application/collect-player-payment";
import {
  switchToPerPlayer,
  switchToWhole,
} from "@/modules/booking/application/switch-collection-mode";
import {
  collectAllRemainingSchema,
  collectSlotSchema,
  considerSharePaidSchema,
  switchToPerPlayerSchema,
  switchToWholeSchema,
} from "@/modules/booking/schemas/per-player";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { peopleWaitingOn } from "@/modules/booking/domain/waitlist";
import { parseAdjustDueForm } from "@/modules/booking/schemas/adjust-due-form";
import { parseBookingDecision } from "@/modules/booking/schemas/booking-decision";
import type { TenderDraft } from "@/modules/payment/domain/collect";
import { parseCollectPayment, type CollectPayment } from "@/modules/payment/schemas/collect-payment";
import { field, redirectOwner } from "@/lib/form-query";
import type { PerPlayerResult } from "@/modules/booking/ui/action-types";
export type { PerPlayerResult };

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
    const rejected = await approveBooking(parsed.bookingId, {
      allowStarted: field(formData, "allowStarted") === "1",
    });
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

export async function submitDismissBooking(formData: FormData) {
  let errorKey: string | undefined;
  let bookingId = "";
  try {
    const parsed = parseBookingDecision({
      bookingId: field(formData, "bookingId"),
    });
    bookingId = parsed.bookingId;
    await rejectBooking(parsed.bookingId);
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitDismissBooking");
  }
  if (errorKey) {
    redirectOwner("/owner/requests", formData, [], { error: errorKey });
  }
  redirectOwner("/owner/requests", formData, [], {
    notify: "dismissed",
    bookingId,
  });
}

export async function submitDismissMissed(formData: FormData) {
  let errorKey: string | undefined;
  try {
    await dismissMissedRequests();
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitDismissMissed");
  }
  if (errorKey) {
    redirectOwner("/owner/requests", formData, [], { error: errorKey });
  }
  redirectOwner("/owner/requests", formData, []);
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
      feeLbp: optionalFeeLbp(formData),
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
      feeLbp: optionalFeeLbp(formData),
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
      toLbp: field(formData, "toLbp"),
      reason: field(formData, "reason"),
      note: field(formData, "note"),
    });
    bookingId = parsed.bookingId;
    await adjustBookingDue({
      bookingId: parsed.bookingId,
      toUsd: parsed.toUsd === undefined ? undefined : parseUsd(parsed.toUsd),
      toLbp: parsed.toLbp === undefined ? undefined : parseLbp(parsed.toLbp),
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

/** The fee typed for a game in pounds (whole pounds; the use case checks the unit). */
function optionalFeeLbp(formData: FormData) {
  const raw = field(formData, "feeLbp").trim();
  if (!raw) return undefined;
  if (!isLbpString(raw)) throw new DomainError("form.invalid");
  return parseLbp(raw);
}

/** The cash typed on a collect form, as tenders (USD first, then LBP). */
function tendersOf(parsed: CollectPayment): TenderDraft[] {
  const tenders: TenderDraft[] = [];
  if (parsed.usdAmount) {
    tenders.push({ currency: "USD", amount: parseUsd(parsed.usdAmount) });
  }
  if (parsed.lbpAmount) {
    tenders.push({ currency: "LBP", amount: parseLbp(parsed.lbpAmount) });
  }
  return tenders;
}

/**
 * The cash a per-player collect carries (DR-007 slice 7): undefined when nothing was typed, which
 * means exactly the charge. Validated like the whole-game form.
 */
function typedCash(input: { bookingId: string; usdAmount?: string; lbpAmount?: string }): TenderDraft[] | undefined {
  if (!input.usdAmount?.trim() && !input.lbpAmount?.trim()) return undefined;
  return tendersOf(parseCollectPayment(input));
}

export async function submitCollectPayment(formData: FormData) {
  let errorKey: string | undefined;
  let change = { changeUsd: "", changeLbp: "" };
  const keepChange = field(formData, "keepChange") === "1";
  let kept = "";
  try {
    const parsed = parseCollectPayment({
      bookingId: field(formData, "bookingId"),
      usdAmount: field(formData, "usdAmount"),
      lbpAmount: field(formData, "lbpAmount"),
    });
    const done = await collectBookingPayment({ bookingId: parsed.bookingId, tenders: tendersOf(parsed), keepChange });
    // The toast tells the owner what to hand back (DR-007). Empty when there is none.
    change = {
      changeUsd: done.changeUsd.gt(0) ? done.changeUsd.toFixed(2) : "",
      changeLbp: done.changeLbp.gt(0) ? done.changeLbp.toFixed(0) : "",
    };
    // "Kept X" instead of "Give back X": only when there was change to keep.
    kept = keepChange && (done.changeUsd.gt(0) || done.changeLbp.gt(0)) ? "1" : "";
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitCollectPayment");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, { ok: "collected", ...change, kept });
}

/** "Consider it paid" (DR-007 decision 8): the use case re-checks under the lock and authorizes. */
export async function submitConsiderPaid(formData: FormData) {
  let errorKey: string | undefined;
  try {
    const parsed = parseBookingDecision({ bookingId: field(formData, "bookingId") });
    await considerGamePaid({ bookingId: parsed.bookingId });
  } catch (error) {
    errorKey = await actionErrorKey(error, "submitConsiderPaid");
  }
  if (errorKey) {
    redirectOwner("/owner/today", formData, TODAY_KEEP, { error: errorKey });
  }
  redirectOwner("/owner/today", formData, TODAY_KEEP, { ok: "considered_paid" });
}

/** What a per-player action hands back: the change to give, or nothing. */
type PerPlayerChange = { changeUsd: Decimal; changeLbp: Decimal; kept?: boolean } | undefined;

async function perPlayer(
  useCase: string,
  run: () => Promise<PerPlayerChange>,
): Promise<PerPlayerResult> {
  let change: PerPlayerChange;
  try {
    change = await run();
  } catch (error) {
    return { error: await actionErrorKey(error, useCase) };
  }
  revalidatePath("/owner/today");
  // What to hand back, so the sheet can say it (empty when there is none).
  return {
    ok: true,
    changeUsd: change && change.changeUsd.gt(0) ? change.changeUsd.toFixed(2) : undefined,
    changeLbp: change && change.changeLbp.gt(0) ? change.changeLbp.toFixed(0) : undefined,
    kept: change?.kept && (change.changeUsd.gt(0) || change.changeLbp.gt(0)) ? true : undefined,
  };
}

export async function submitSwitchToPerPlayer(input: {
  bookingId: string;
  count: number;
}): Promise<PerPlayerResult> {
  return perPlayer("submitSwitchToPerPlayer", async () => {
    await switchToPerPlayer(switchToPerPlayerSchema.parse(input));
    return undefined;
  });
}

export async function submitSwitchToWhole(input: {
  bookingId: string;
}): Promise<PerPlayerResult> {
  return perPlayer("submitSwitchToWhole", async () => {
    await switchToWhole(switchToWholeSchema.parse(input));
    return undefined;
  });
}

export async function submitCollectSlot(input: {
  bookingId: string;
  participantId: string;
  usdAmount?: string;
  lbpAmount?: string;
  keepChange?: boolean;
}): Promise<PerPlayerResult> {
  return perPlayer("submitCollectSlot", async () => {
    const parsed = collectSlotSchema.parse(input);
    const done = await collectSlotPayment({
      bookingId: parsed.bookingId,
      participantId: parsed.participantId,
      tenders: typedCash(parsed),
      keepChange: parsed.keepChange,
    });
    return { ...done, kept: parsed.keepChange };
  });
}

export async function submitCollectAllRemaining(input: {
  bookingId: string;
  usdAmount?: string;
  lbpAmount?: string;
}): Promise<PerPlayerResult> {
  return perPlayer("submitCollectAllRemaining", async () => {
    const parsed = collectAllRemainingSchema.parse(input);
    return collectAllRemaining({ bookingId: parsed.bookingId, tenders: typedCash(parsed) });
  });
}

/** "Consider it paid" on one share (DR-007 slice 7); the use case re-checks under the lock. */
export async function submitConsiderSharePaid(input: {
  bookingId: string;
  participantId: string;
}): Promise<PerPlayerResult> {
  return perPlayer("submitConsiderSharePaid", async () => {
    await considerSharePaid(considerSharePaidSchema.parse(input));
    return undefined;
  });
}
