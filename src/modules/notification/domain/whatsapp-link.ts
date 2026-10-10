import { DomainError } from "@/lib/errors";
import { messageIntentFor, type MessageContext, type MessageIntent, type MessageState } from "@/modules/notification/domain/message-intent";

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
  /** Null or omitted when the stadium has one pitch: the clause is left out. */
  pitchName?: string | null;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    const pitch = input.pitchName ? ` on ${embed(input.pitchName)}` : "";
    return `Hello ${embed(input.name)}, your booking at ${embed(input.stadiumName)} on ${embed(input.day)} at ${embed(input.time)}${pitch} is confirmed. See you!`;
  }
  const pitch = input.pitchName ? ` على ${embed(input.pitchName)}` : "";
  return `مرحبا ${embed(input.name)}، تأكد حجزك في ${embed(input.stadiumName)} يوم ${embed(input.day)} الساعة ${embed(input.time)}${pitch}. منشوفك!`;
}

/** A weekly series was booked. Arabic is Lebanese. */
export function seriesConfirmedMessage(input: {
  name: string;
  stadiumName: string;
  weekday: string;
  time: string;
  /** The first date, already formatted ("Tuesday 14 October"). */
  day: string;
  games: number;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, your weekly booking at ${embed(input.stadiumName)} is confirmed: every ${embed(input.weekday)} at ${embed(input.time)}, starting ${embed(input.day)}, ${input.games} games. See you!`;
  }
  return `مرحبا ${embed(input.name)}، تأكد حجزك الثابت في ${embed(input.stadiumName)}: كل ${embed(input.weekday)} الساعة ${embed(input.time)}، ابتداءً من ${embed(input.day)}، ${input.games} مباريات. منشوفك!`;
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

/**
 * Missed request, dismissed. No rejection reason.
 * Arabic is the Lebanese line the owner can send as-is.
 */
export function bookingMissedMessage(input: {
  name: string;
  day: string;
  time: string;
  link: string;
  locale?: MessageLocale;
}): string {
  if (input.locale === "en") {
    return `Hello ${embed(input.name)}, we missed your request for ${embed(input.day)} at ${embed(input.time)}. To book again: ${embed(input.link)}`;
  }
  return `مرحبا ${embed(input.name)}، للأسف فاتنا طلبك ليوم ${embed(input.day)} الساعة ${embed(input.time)}. إذا بدك تحجز من جديد: ${embed(input.link)}`;
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

/**
 * Everything any message may say, already as local strings. The caller states the facts; the intent
 * (decided by `messageIntentFor`) decides which of them the message uses.
 */
export type MessageFacts = {
  name: string;
  stadiumName: string;
  day: string;
  time: string;
  /** Null or omitted when the stadium has one pitch. */
  pitchName?: string | null;
  /** The public page link (a declined or owner-cancelled player can pick another time). */
  link?: string;
  reason?: string | null;
  /** A cancellation fee already formatted ("$15"), when one was charged. */
  fee?: string | null;
  /** The owed amount already formatted in the obligation's currency. */
  amount?: string;
  /** Since when it is owed (a local date string); the game day when omitted. */
  since?: string;
  /** Who cancelled. */
  initiator?: "OWNER" | "PLAYER";
  /** The weekday of a weekly series ("Tuesday"). */
  weekday?: string;
  /** How many games a weekly series has. */
  games?: number;
};

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`WhatsApp message is missing ${what}`);
  }
  return value;
}

/** The text for an intent. The only place that maps an intent to a template. */
export function composeMessage(intent: MessageIntent, facts: MessageFacts, locale: MessageLocale): string {
  const shared = { name: facts.name, day: facts.day, time: facts.time, locale };
  switch (intent) {
    case "CONFIRMED":
      return bookingConfirmedMessage({ ...shared, stadiumName: facts.stadiumName, pitchName: facts.pitchName });
    case "DECLINED":
      return bookingRejectedMessage({ ...shared, reason: facts.reason, link: need(facts.link, "the page link") });
    case "CANCELLED":
      if (facts.initiator === "OWNER") {
        return bookingCancelledByOwnerMessage({ ...shared, link: need(facts.link, "the page link") });
      }
      return facts.fee ? bookingCancelledByPlayerFeeMessage({ ...shared, fee: facts.fee }) : bookingCancelledByPlayerMessage(shared);
    case "SLOT_AVAILABLE":
      return slotAvailableMessage({ ...shared, stadiumName: facts.stadiumName });
    case "SERIES_CONFIRMED":
      return seriesConfirmedMessage({
        ...shared,
        stadiumName: facts.stadiumName,
        weekday: need(facts.weekday, "the weekday"),
        games: need(facts.games, "the number of games"),
      });
    case "PAYMENT_REMINDER":
      return paymentReminderMessage({
        name: facts.name,
        amount: need(facts.amount, "the amount"),
        date: facts.since ?? facts.day,
        locale,
      });
  }
}

export type NotifyLink = {
  intent: MessageIntent | null;
  /** The text the link carries; null when it just opens the chat. */
  message: string | null;
  /** The wa.me link; null when there is no phone or it cannot be turned into a WhatsApp number. */
  href: string | null;
};

/**
 * The one door every WhatsApp entry point goes through: ask the decision function what the message
 * is for, write it from the saved facts, build the link. Never throws on a bad phone: the button is
 * hidden (href null), never a broken link.
 */
export function notifyLink(input: {
  context: MessageContext;
  state?: MessageState;
  phone: string | null;
  /** Needed when the context carries a text; contexts that only open the chat can omit it. */
  facts?: MessageFacts;
  locale: MessageLocale;
}): NotifyLink {
  const intent = messageIntentFor(input.context, input.state);
  const message = intent ? composeMessage(intent, need(input.facts, "the facts"), input.locale) : null;
  let href: string | null = null;
  if (input.phone) {
    try {
      href = message ? whatsAppHref(input.phone, message) : whatsAppChatHref(input.phone);
    } catch {
      href = null;
    }
  }
  return { intent, message, href };
}

/** A wa.me link that opens the chat with no text. */
export function whatsAppChatHref(phoneDigits: string): string {
  return `https://wa.me/${toLebanonWhatsAppNumber(phoneDigits)}`;
}

/** Just the text for a context (the cancel and no-show forms preview it before anything is saved). */
export function previewMessage(input: {
  context: MessageContext;
  state?: MessageState;
  facts: MessageFacts;
  locale: MessageLocale;
}): string | null {
  const intent = messageIntentFor(input.context, input.state);
  return intent ? composeMessage(intent, input.facts, input.locale) : null;
}
