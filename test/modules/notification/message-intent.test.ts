import { describe, expect, it } from "@jest/globals";
import { messageIntentFor, type MessageContext, type MessageIntent, type MessageState } from "@/modules/notification/domain/message-intent";
import { composeMessage, notifyLink, previewMessage, type MessageFacts } from "@/modules/notification/domain/whatsapp-link";

/** One row per context and state: what the message is for, null = open the chat with no text. */
const TABLE: [MessageContext, MessageState, MessageIntent | null][] = [
  // The booking sheet header icon.
  ["booking_header", {}, null],
  ["booking_header", { gameEnded: false, owed: false }, null],
  ["booking_header", { gameEnded: false, owed: true }, null], // not played yet: money is expected, not owed
  ["booking_header", { gameEnded: true, owed: false }, null], // played and settled
  ["booking_header", { gameEnded: true, owed: true }, "PAYMENT_REMINDER"],
  // The person page.
  ["person_page", {}, null],
  ["person_page", { gameEnded: true, owed: true }, null],
  // Decisions on a request.
  ["after_approve", {}, "CONFIRMED"],
  ["after_reject", {}, "DECLINED"],
  ["request_auto_rejected", {}, "DECLINED"],
  ["request_dismissed", {}, "DECLINED"],
  // Outcomes.
  ["after_cancel", {}, "CANCELLED"],
  ["after_cancel", { feeCharged: true }, "CANCELLED"],
  ["after_no_show", { feeCharged: false }, null],
  ["after_no_show", {}, null],
  ["after_no_show", { feeCharged: true }, "PAYMENT_REMINDER"],
  ["after_adjust", { owed: false }, null],
  ["after_adjust", {}, null],
  ["after_adjust", { owed: true }, "PAYMENT_REMINDER"],
  // Freed slot, debts.
  ["freed_slot", {}, "SLOT_AVAILABLE"],
  ["earlier_debt", {}, "PAYMENT_REMINDER"],
  ["owed_page", {}, "PAYMENT_REMINDER"],
];

describe("messageIntentFor", () => {
  it.each(TABLE)("%s %j -> %s", (context, state, intent) => {
    expect(messageIntentFor(context, state)).toBe(intent);
  });

  it("covers every context at least once", () => {
    const all: MessageContext[] = [
      "booking_header", "person_page", "after_approve", "after_reject", "request_auto_rejected", "request_dismissed",
      "after_cancel", "after_no_show", "after_adjust", "freed_slot", "earlier_debt", "owed_page",
    ];
    for (const context of all) expect(TABLE.some(([name]) => name === context)).toBe(true);
  });
});

const facts: MessageFacts = {
  name: "Ali",
  stadiumName: "Stadium",
  day: "Friday 9 Oct",
  time: "8:00 PM",
  link: "https://x.example/",
  amount: "$20",
};

describe("notifyLink: the one door", () => {
  it("a null intent opens the chat with no text", () => {
    const link = notifyLink({ context: "person_page", phone: "03900003", locale: "en" });
    expect(link).toEqual({ intent: null, message: null, href: "https://wa.me/9613900003" });
    const header = notifyLink({ context: "booking_header", state: { gameEnded: false, owed: true }, phone: "03900003", facts, locale: "en" });
    expect(header.href).toBe("https://wa.me/9613900003");
  });

  it("an intent carries its text, URL-encoded", () => {
    const link = notifyLink({ context: "owed_page", phone: "03900003", facts, locale: "en" });
    expect(link.intent).toBe("PAYMENT_REMINDER");
    expect(link.href?.startsWith("https://wa.me/9613900003?text=")).toBe(true);
    expect(decodeURIComponent(link.href!.split("?text=")[1]!)).toBe(link.message);
    expect(link.message).toContain("$20");
  });

  it("a declined request, however it was declined, carries the public page link", () => {
    for (const context of ["after_reject", "request_auto_rejected", "request_dismissed"] as const) {
      expect(notifyLink({ context, phone: "03900003", facts, locale: "en" }).message).toContain("https://x.example/");
      expect(notifyLink({ context, phone: "03900003", facts, locale: "ar" }).message).toContain("https://x.example/");
    }
  });

  it("a cancellation says the fee when one was charged", () => {
    const withFee = notifyLink({ context: "after_cancel", phone: "03900003", facts: { ...facts, fee: "$15", initiator: "PLAYER" }, locale: "en" });
    expect(withFee.message).toContain("$15");
    const without = notifyLink({ context: "after_cancel", phone: "03900003", facts: { ...facts, initiator: "PLAYER" }, locale: "en" });
    expect(without.message).not.toContain("$");
  });

  it("no phone, or a phone that cannot be a WhatsApp number: no link, never a broken one", () => {
    expect(notifyLink({ context: "after_approve", phone: null, facts, locale: "en" }).href).toBeNull();
    expect(notifyLink({ context: "after_approve", phone: "12x45", facts, locale: "en" }).href).toBeNull();
    expect(notifyLink({ context: "person_page", phone: "abc", locale: "en" }).href).toBeNull();
  });

  it("a context with text and no facts is a programming error, not a silent empty message", () => {
    expect(() => notifyLink({ context: "after_approve", phone: "03900003", locale: "en" })).toThrow();
  });

  it("previewMessage is the same text without the link", () => {
    expect(previewMessage({ context: "after_no_show", state: { feeCharged: false }, facts, locale: "en" })).toBeNull();
    expect(previewMessage({ context: "after_no_show", state: { feeCharged: true }, facts, locale: "en" })).toBe(
      composeMessage("PAYMENT_REMINDER", facts, "en"),
    );
  });
});
