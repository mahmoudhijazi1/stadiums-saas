import type { UiLocale } from "@/lib/locale";
import { ui, uiCount } from "@/lib/copy";
import type { CardDisplay } from "@/modules/booking/domain/card-display";

/**
 * The one status chip under the name in the game sheet. Pure: from the card state the server already
 * worked out (`display`, the same states as the Today card), the start and the clock. Colour never alone:
 * every tone has its words, and paid and owing have an icon on screen.
 */
export type GameStatusTone = "neutral" | "accent" | "owed" | "paid";

export type GameStatus = {
  kind: "upcoming" | "playing" | "unpaid" | "partial" | "paid" | "no_show" | "cancelled";
  tone: GameStatusTone;
  label: string;
};

/** "in 25 min" / "in 2 hours" / "in 3 days" (AR: بعد ...): the coarsest unit that fits, rounded up. */
export function startsIn(startMs: number, nowMs: number, locale: UiLocale): string {
  const minutes = Math.max(1, Math.ceil((startMs - nowMs) / 60_000));
  if (minutes < 60) return uiCount("owner.inMinutes", minutes, locale);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return uiCount("owner.inHours", hours, locale);
  return uiCount("owner.inDays", Math.round(hours / 24), locale);
}

export function gameStatus(input: { display: CardDisplay; startMs: number; nowMs: number; locale: UiLocale }): GameStatus {
  const { display, locale } = input;
  switch (display.kind) {
    case "before":
      return {
        kind: "upcoming",
        tone: "neutral",
        label: ui("owner.chipUpcoming", locale).replace("{time}", startsIn(input.startMs, input.nowMs, locale)),
      };
    case "live":
      return { kind: "playing", tone: "accent", label: ui("owner.chipPlaying", locale) };
    case "unpaid":
      return { kind: "unpaid", tone: "owed", label: ui("owner.chipUnpaid", locale) };
    case "partial":
      return { kind: "partial", tone: "owed", label: ui("owner.chipPartial", locale) };
    case "paid":
      return { kind: "paid", tone: "paid", label: ui("owner.chipPaid", locale) };
    case "no_show_unpaid":
      return { kind: "no_show", tone: "owed", label: ui("owner.noShow", locale) };
    case "no_show_paid":
      return { kind: "no_show", tone: "neutral", label: ui("owner.noShow", locale) };
    case "cancelled":
      return { kind: "cancelled", tone: "neutral", label: ui("owner.chipCancelled", locale) };
  }
}
