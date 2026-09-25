import { DomainError } from "@/lib/errors";

export type MessageLocale = "ar" | "en";

/**
 * Build a WhatsApp click-to-chat URL (BR-30 / BR-69). Domain only — no send, no Booking.
 * Lebanon: 03… → 961…; already-961 stays. Owner taps send in WhatsApp.
 */
export function whatsAppHref(phoneDigits: string, text: string): string {
  const e164 = toLebanonWhatsAppNumber(phoneDigits);
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

/** First-strong isolate. Keeps a placeholder's own direction inside the sentence. */
function embed(value: string): string {
  return `\u2068${value}\u2069`;
}

/**
 * Slot now available. Arabic is Lebanese. Times and the day are already local strings.
 * Stadium stays as stored (RULE-11).
 */
export function slotAvailableMessage(input: {
  name: string;
  time: string;
  day: string;
  stadiumName: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, ${embed(input.time)} on ${embed(input.day)} is now free at ${embed(input.stadiumName)}. If you still want it, tell us.`;
  }
  return `مرحبا ${embed(input.name)}، الساعة ${embed(input.time)} يوم ${embed(input.day)} صارت متاحة بـ${embed(input.stadiumName)}. إذا بعدك بدك ياها، احكينا.`;
}

/** Booking confirmed. Arabic is Lebanese. */
export function bookingConfirmedMessage(input: {
  name: string;
  stadiumName: string;
  day: string;
  time: string;
  pitchName: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, your booking at ${embed(input.stadiumName)} on ${embed(input.day)} at ${embed(input.time)} on ${embed(input.pitchName)} is confirmed. See you!`;
  }
  return `مرحبا ${embed(input.name)}، تأكد حجزك في ${embed(input.stadiumName)} يوم ${embed(input.day)} الساعة ${embed(input.time)} على ${embed(input.pitchName)}. منشوفك!`;
}

/**
 * Booking rejected. {reason} is " (reason)" or empty.
 * `ending: "wait"` is the auto-reject after someone else was approved.
 * Manual reject keeps the public-hours link (`"link"`, the default).
 */
export function bookingRejectedMessage(input: {
  name: string;
  day: string;
  time: string;
  reason?: string | null;
  link: string;
  ending?: "link" | "wait";
  locale?: MessageLocale;
}): string {
  const reason = reasonClause(input.reason);
  if (input.ending === "wait") {
    if (input.locale === "en") {
      return `Hello ${embed(input.name)}, we can't confirm your booking on ${embed(input.day)} at ${embed(input.time)}${reason}. We'll tell you if it frees up.`;
    }
    return `مرحبا ${embed(input.name)}، للأسف ما منقدر نأكدلك حجز ${embed(input.day)} الساعة ${embed(input.time)}${reason}. إذا فضيت الساعة منخبرك.`;
  }
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, we can't confirm your booking on ${embed(input.day)} at ${embed(input.time)}${reason}. If you want another time, see the open hours: ${embed(input.link)}`;
  }
  return `مرحبا ${embed(input.name)}، للأسف ما منقدر نأكدلك حجز ${embed(input.day)} الساعة ${embed(input.time)}${reason}. إذا بدك وقت تاني، شوف الساعات المتاحة: ${embed(input.link)}`;
}

/** Player cancelled, no fee. */
export function bookingCancelledByPlayerMessage(input: {
  name: string;
  day: string;
  time: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, your booking on ${embed(input.day)} at ${embed(input.time)} is cancelled.`;
  }
  return `مرحبا ${embed(input.name)}، انلغى حجزك يوم ${embed(input.day)} الساعة ${embed(input.time)}.`;
}

/** Player cancelled with a fee. `fee` is already a compact amount such as "$15". */
export function bookingCancelledByPlayerFeeMessage(input: {
  name: string;
  day: string;
  time: string;
  fee: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, your booking on ${embed(input.day)} at ${embed(input.time)} is cancelled. Cancellation fee: ${embed(input.fee)}.`;
  }
  return `مرحبا ${embed(input.name)}، انلغى حجزك يوم ${embed(input.day)} الساعة ${embed(input.time)}. رسوم الإلغاء ${embed(input.fee)}.`;
}

/** Owner cancelled. */
export function bookingCancelledByOwnerMessage(input: {
  name: string;
  day: string;
  time: string;
  link: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, we had to cancel your booking on ${embed(input.day)} at ${embed(input.time)}. Sorry — if you want another time: ${embed(input.link)}`;
  }
  return `مرحبا ${embed(input.name)}، اضطرينا نلغي حجزك يوم ${embed(input.day)} الساعة ${embed(input.time)}. منعتذر منك، وإذا بدك وقت تاني: ${embed(input.link)}`;
}

/** No-show with a fee. `fee` is already compact, such as "$15". Arabic is Lebanese. */
export function bookingNoShowFeeMessage(input: {
  name: string;
  day: string;
  time: string;
  fee: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, you missed your booking on ${embed(input.day)} at ${embed(input.time)}. No-show fee ${embed(input.fee)}.`;
  }
  return `مرحبا ${embed(input.name)}، ما إجيت على حجزك يوم ${embed(input.day)} الساعة ${embed(input.time)}. رسوم عدم الحضور ${embed(input.fee)}.`;
}

/** No-show with no fee. Arabic is Lebanese. */
export function bookingNoShowMessage(input: {
  name: string;
  day: string;
  time: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, you missed your booking on ${embed(input.day)} at ${embed(input.time)}. See you next time!`;
  }
  return `مرحبا ${embed(input.name)}، ما إجيت على حجزك يوم ${embed(input.day)} الساعة ${embed(input.time)}. نشوفك المرة الجاي!`;
}

/** Payment reminder. `amount` is already compact, such as "$15". */
export function paymentReminderMessage(input: {
  name: string;
  amount: string;
  date: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, you owe ${embed(input.amount)} from ${embed(input.date)}. Thank you!`;
  }
  return `مرحبا ${embed(input.name)}، في عليك ${embed(input.amount)} من ${embed(input.date)}. شكراً!`;
}

function reasonClause(reason: string | null | undefined): string {
  const text = reason?.trim() ?? "";
  return text ? ` (${embed(text)})` : "";
}

function toLebanonWhatsAppNumber(phoneDigits: string): string {
  if (!/^\d+$/.test(phoneDigits)) {
    throw new DomainError("notification.bad_phone");
  }

  let e164: string;
  if (phoneDigits.startsWith("961")) {
    e164 = phoneDigits;
  } else if (phoneDigits.startsWith("0")) {
    e164 = `961${phoneDigits.slice(1)}`;
  } else {
    e164 = `961${phoneDigits}`;
  }

  if (!/^961\d{7,}$/.test(e164)) {
    throw new DomainError("notification.bad_phone");
  }
  return e164;
}
