import type { UiLocale } from "@/lib/locale";
import { displayChange, formatChange } from "@/lib/format/money";
import { plural, type PluralForms } from "@/lib/plural";
import { countedForms, uiCount } from "./counted";
import { ui } from "./ui";

const REJECT_REASON_NOTE_MAX = 80;

/**
 * Chip label, or the free-text note for "other". Empty or too long → null.
 * The note is not stored; it only fills the WhatsApp {reason}.
 */
export function rejectReasonText(
  kind: string,
  note: string,
  locale: UiLocale = "ar",
): string | null {
  if (kind === "slot_taken") return ui("owner.rejectReason.slotTaken", locale);
  if (kind === "pitch_closed") return ui("owner.rejectReason.pitchClosed", locale);
  if (kind !== "other") return null;
  const text = note.trim().replace(/\s+/g, " ");
  if (!text || text.length > REJECT_REASON_NOTE_MAX) return null;
  return text;
}

/** Empty hours: closed / past date / today exhausted. */
export function hoursEmptyState(
  kind: "closed" | "past" | "hoursEnded",
  locale: UiLocale = "ar",
): { title: string; next: string } {
  if (kind === "past") {
    return {
      title: ui("public.pastDate", locale),
      next: ui("public.pastDateNext", locale),
    };
  }
  if (kind === "hoursEnded") {
    return {
      title: ui("public.hoursEnded", locale),
      next: ui("public.hoursEndedNext", locale),
    };
  }
  return {
    title: ui("public.closed", locale),
    next: ui("public.closedNext", locale),
  };
}

/**
 * The Money page's shop row: "Shop · sales $120 this month". The amount stays inside the phrase so
 * the caller can isolate it; the period reads as a short phrase ("this month", "today", ...).
 */
export function shopRowLine(
  kind: "today" | "week" | "month" | "last" | "custom",
  name: string,
  amount: string,
  locale: UiLocale = "ar",
): string {
  if (locale === "en") {
    const when =
      kind === "today" ? "today" : kind === "week" ? "this week" : kind === "month" ? "this month" : `in ${name}`;
    return `Shop · sales ${amount} ${when}`;
  }
  const when =
    kind === "today" ? "اليوم" : kind === "week" ? "هذا الأسبوع" : kind === "month" ? "هذا الشهر" : `في ${name}`;
  return `المتجر · مبيعات ${amount} ${when}`;
}

/** Pending heading with a Western count. */
export function pendingCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.pending", locale)} · ${n}`;
}

/** Requests heading. Digits stay inside the phrase so the caller can isolate them. */
export function requestsCount(n: number, locale: UiLocale = "ar"): string {
  return uiCount("owner.requests", n, locale);
}

/** Collapsed missed-request heading. Digits stay in the phrase. */
export function missedRequestsCount(n: number, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Missed requests (${n})` : `طلبات فائتة (${n})`;
}

/** Amber line for a future request starting within 2 hours. */
export function startsInLabel(minutes: number, locale: UiLocale = "ar"): string {
  const span = uiCount("owner.spanMinutes", minutes, locale);
  return locale === "en" ? `Starts in ${span}` : `يبدأ بعد ${span}`;
}

/**
 * Public late-cancel line. Empty when the percent is 0.
 * `{hours}` is the plural hour phrase ("24 ساعة").
 */
export function cancelPolicyLine(
  hours: number,
  percent: number,
  locale: UiLocale = "ar",
): string {
  if (percent <= 0) return "";
  return ui("public.cancelPolicy", locale)
    .replace("{hours}", uiCount("owner.ruleHours", hours, locale))
    .replace("{percent}", String(percent));
}

/** Confirmed heading with a Western count. */
export function confirmedCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.confirmed", locale)} · ${n}`;
}

/** Overdue heading with a Western count. */
export function overdueCount(n: number, locale: UiLocale = "ar"): string {
  return `${ui("owner.overdue", locale)} · ${n}`;
}

/** Collect remaining USD — amount is already formatUsd (Latin). */
export function collectUsdLabel(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Collect $${amount}` : `تحصيل $${amount}`;
}

/** Slot name before anyone is named. */
export function playerLabel(slotNumber: number, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Player ${slotNumber}` : `لاعب ${slotNumber}`;
}

/** Per-player progress on the booking sheet. Counts are plain numbers. */
export function paidOfLine(
  paid: number,
  total: number,
  locale: UiLocale = "ar",
): string {
  return locale === "en"
    ? `${paid} of ${total} paid`
    : `${paid} من ${total} دفعوا`;
}

/** Booker pays every unpaid slot. Amount is already formatUsd (Latin). */
/** Night hint beside a real date for a 00:00–05:59 start. `weekday` is already localized. */
export function nightOfLabel(weekday: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `night of ${weekday}` : `ليلة ${weekday}`;
}

/** The day-start hour as a clock label: "6:00 ص" / "6:00 AM"; 0 is "12:00". */
export function dayStartClock(hour: number, locale: UiLocale = "ar"): string {
  return `${hour === 0 ? 12 : hour}:00 ${locale === "en" ? "AM" : "ص"}`;
}

/** Toast after "log out other devices": how many were closed. */
export function devicesClosedLabel(count: number, locale: UiLocale = "ar"): string {
  if (locale === "en") {
    return count === 0
      ? "No other devices were logged in."
      : `Logged out of ${count} other ${count === 1 ? "device" : "devices"}.`;
  }
  return count === 0 ? "لا توجد أجهزة أخرى مسجّلة." : `تم تسجيل الخروج من ${count} جهاز.`;
}

/** Preview line: "5 games · $20 each" or "5 games · $20–$30". Prices are already "20.00". */
export function previewSummaryLabel(
  games: number,
  min: string,
  max: string,
  locale: UiLocale = "ar",
): string {
  const price = (value: string) => (value.endsWith(".00") ? value.slice(0, -3) : value);
  const range = min === max ? price(min) : `${price(min)}–$${price(max)}`;
  if (locale === "en") {
    return `${games} ${games === 1 ? "game" : "games"} · $${range}${min === max ? " each" : ""}`;
  }
  return `${games} ${games === 1 ? "مباراة" : "مباريات"} · $${range}${min === max ? " للمباراة" : ""}`;
}

/** Muted note when the end of the opening hours cannot fit another game. */
export function unusedTimeLabel(minutes: number, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `The last ${minutes} min of the opening hours are too short for a game.`
    : `آخر ${minutes} دقيقة من ساعات الفتح لا تكفي لمباراة.`;
}

export function gameLongerLabel(minutes: number, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `A game of ${minutes} min does not fit in these hours.`
    : `مباراة من ${minutes} دقيقة لا تتسع لهذه الساعات.`;
}

/** The Money headline label: "Profit in October", "Loss this week", "Profit, 12 Oct – 18 Oct". */
export function profitHeadline(
  kind: "today" | "week" | "month" | "last" | "custom",
  name: string,
  loss: boolean,
  locale: UiLocale = "ar",
): string {
  if (locale === "en") {
    const word = loss ? "Loss" : "Profit";
    if (kind === "today") return `${word} today`;
    if (kind === "week") return `${word} this week`;
    if (kind === "custom") return `${word}, ${name}`;
    return `${word} in ${name}`;
  }
  const word = loss ? "الخسارة" : "الربح";
  if (kind === "today") return `${word} اليوم`;
  if (kind === "week") return `${word} هذا الأسبوع`;
  if (kind === "custom") return `${word}، ${name}`;
  return `${word} في ${name}`;
}

/** "↑ $5 vs September" / "Same as September". Amounts are already formatted. */
export function comparisonLine(
  direction: "up" | "down" | "same",
  amount: string,
  against: string,
  locale: UiLocale = "ar",
): string {
  if (direction === "same") return locale === "en" ? `Same as ${against}` : `مثل ${against}`;
  const arrow = direction === "up" ? "↑" : "↓";
  return locale === "en" ? `${arrow} ${amount} vs ${against}` : `${arrow} ${amount} مقارنة بـ${against}`;
}

/** The Activity row of a sale: "Shop · 3 items". */
export function shopActivityLabel(items: number, locale: UiLocale = "ar"): string {
  if (items <= 0) return locale === "en" ? "Shop" : "المتجر";
  if (locale === "en") return `Shop · ${items} ${items === 1 ? "item" : "items"}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `المتجر · صنفان` : `المتجر · ${items} ${word}`;
}

/**
 * "Change: 40,000 ل.ل" / "الباقي للزبون: 40,000 ل.ل": what to hand back, in the currency it was
 * handed over in, with cents of dollars shown as pounds at the current rate (`displayChange`).
 * Empty when there is none.
 */
export function changeDescription(
  change: { lbp: string; usd: string },
  locale: UiLocale = "ar",
  rate: string | null = null,
): string | undefined {
  const text = formatChange(displayChange(change, rate), locale);
  return text === "0" ? undefined : `${ui("owner.changeLabel", locale)}: ${text}`;
}

/** The last suggestion of the payer search: add the typed text as a new person. */
export function addNewLabel(text: string, locale: UiLocale = "ar"): string {
  return locale === "en" ? `Add "${text}" as new` : `إضافة "${text}" كجديد`;
}

/** The toast after items are put on a game: "Added 3 items · $12". `total` is already formatted. */
export function itemsAddedToast(items: number, total: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return `Added ${items} ${items === 1 ? "item" : "items"} · ${total}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `أُضيف صنفان · ${total}` : `أُضيف ${items} ${word} · ${total}`;
}

/** The toast after a walk-in sale: "Sold 3 items · $12". `total` is already formatted. */
export function soldToast(items: number, total: string, locale: UiLocale = "ar"): string {
  if (locale === "en") return `Sold ${items} ${items === 1 ? "item" : "items"} · ${total}`;
  const word = items === 1 ? "صنف" : items === 2 ? "صنفان" : items <= 10 ? "أصناف" : "صنفاً";
  return items === 2 ? `بيع صنفان · ${total}` : `بيع ${items} ${word} · ${total}`;
}

export function bookerPaysAllLabel(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `Booker pays all remaining $${amount}`
    : `الحاجز يدفع كل المتبقي $${amount}`;
}

/** Confirmed card due line. Amounts are already formatUsd (Latin). */
export function dueRemainingLine(
  due: string,
  remaining: string,
  locale: UiLocale = "ar",
): string {
  return locale === "en"
    ? `Due $${due} · remaining $${remaining}`
    : `المستحق $${due} · المتبقي $${remaining}`;
}

/** Exchange-rate card line. Amount is Latin digits, no currency symbol. */
export function lbpPerUsdLine(amount: string, locale: UiLocale = "ar"): string {
  return locale === "en"
    ? `${amount} LBP per USD`
    : `${amount} ليرة لكل دولار`;
}

/** Western thousands separator for a whole-number digit string. */
export function groupedDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


/** "Book 7 games" / "احجز 7 مباريات" (verb "book"), "Add 7 games" / "أضف 7 مباريات" (verb "add"). */
export function seriesGamesLabel(verb: "book" | "add", count: number, locale: UiLocale = "ar"): string {
  if (locale === "en") {
    return plural("en", count, {
      one: `${verb === "book" ? "Book" : "Add"} {n} game`,
      other: `${verb === "book" ? "Book" : "Add"} {n} games`,
    });
  }
  const lead = verb === "book" ? "احجز" : "أضف";
  return plural("ar", count, {
    zero: `${lead} {n} مباراة`,
    one: `${lead} مباراة`,
    two: `${lead} مباراتين`,
    few: `${lead} {n} مباريات`,
    many: `${lead} {n} مباراة`,
    other: `${lead} {n} مباراة`,
  });
}

/** "7 games" / "7 مباريات" for a plain count. */
export function seriesGamesCount(count: number, locale: UiLocale = "ar"): string {
  if (locale === "en") return plural("en", count, { one: "{n} game", other: "{n} games" });
  return plural("ar", count, {
    zero: "{n} مباراة",
    one: "مباراة",
    two: "مباراتان",
    few: "{n} مباريات",
    many: "{n} مباراة",
    other: "{n} مباراة",
  });
}
