import { describe, expect, it } from "@jest/globals";
import {
  bookingCancelledByOwnerMessage,
  bookingCancelledByPlayerFeeMessage,
  bookingCancelledByPlayerMessage,
  bookingConfirmedMessage,
  bookingMissedMessage,
  bookingNoShowFeeMessage,
  bookingNoShowMessage,
  bookingRejectedMessage,
  paymentReminderMessage,
  slotAvailableMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

function embed(value: string): string {
  return `\u2068${value}\u2069`;
}

describe("whatsAppHref", () => {
  it("maps a local 03 number to wa.me 961", () => {
    const href = whatsAppHref("03123456", "hello");
    expect(href.startsWith("https://wa.me/9613123456?text=")).toBe(true);
    expect(href).toContain(encodeURIComponent("hello"));
  });

  it("leaves an already-961 number unchanged", () => {
    const href = whatsAppHref("9613123456", "hello");
    expect(href.startsWith("https://wa.me/9613123456?text=")).toBe(true);
  });

  it("prefixes 961 when there is no leading 0", () => {
    expect(whatsAppHref("31234567", "x").startsWith("https://wa.me/96131234567?text=")).toBe(
      true,
    );
  });

  it.each(["", "03 123 456", "abc", "0", "03"])(
    "refuses %s",
    (phone) => {
      expect(() => whatsAppHref(phone, "hello")).toThrow(
        "notification.bad_phone",
      );
    },
  );
});

describe("slotAvailableMessage", () => {
  it("uses the Lebanese body", () => {
    expect(
      slotAvailableMessage({
        name: "أحمد",
        time: "21:00",
        day: "الجمعة",
        stadiumName: "Ahmad Stadium",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، الساعة ${embed("21:00")} يوم ${embed("الجمعة")} صارت متاحة بـ${embed("Ahmad Stadium")}. إذا بعدك بدك ياها، احكينا.`,
    );
  });
});

describe("bookingConfirmedMessage", () => {
  it("uses the Lebanese body", () => {
    expect(
      bookingConfirmedMessage({
        name: "أحمد",
        stadiumName: "Ahmad Stadium",
        day: "الجمعة",
        time: "21:00",
        pitchName: "Pitch 1",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، تأكد حجزك في ${embed("Ahmad Stadium")} يوم ${embed("الجمعة")} الساعة ${embed("21:00")} على ${embed("Pitch 1")}. منشوفك!`,
    );
  });
});

describe("bookingMissedMessage", () => {
  it("uses the Lebanese missed-request line and embeds the link", () => {
    expect(
      bookingMissedMessage({
        name: "أحمد",
        day: "الاثنين، 21 أيلول",
        time: "4:00 مساءً",
        link: "http://ahmad.localhost:3000/",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، للأسف فاتنا طلبك ليوم ${embed("الاثنين، 21 أيلول")} الساعة ${embed("4:00 مساءً")}. إذا بدك تحجز من جديد: ${embed("http://ahmad.localhost:3000/")}`,
    );
  });
});

describe("bookingRejectedMessage", () => {
  it("wraps a reason and leaves it out when empty", () => {
    expect(
      bookingRejectedMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "21:00",
        reason: "الملعب محجوز",
        link: "https://ahmad.localhost/",
      }),
    ).toContain(` (${embed("الملعب محجوز")}).`);
    expect(
      bookingRejectedMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "21:00",
        reason: "  ",
        link: "https://ahmad.localhost/",
      }),
    ).not.toContain("()");
  });

  it("keeps the public-hours link on a manual reject", () => {
    const message = bookingRejectedMessage({
      name: "أحمد",
      day: "الجمعة",
      time: "21:00",
      reason: "الملعب محجوز",
      link: "https://ahmad.localhost/",
    });
    expect(message.endsWith(`: ${embed("https://ahmad.localhost/")}`)).toBe(true);
    expect(message).not.toContain("إذا فضيت الساعة منخبرك.");
  });

  it("ends an auto-reject with the wait line and no hours link", () => {
    const message = bookingRejectedMessage({
      name: "أحمد",
      day: "الجمعة",
      time: "21:00",
      reason: "الساعة محجوزة",
      link: "https://ahmad.localhost/",
      ending: "wait",
    });
    expect(message.endsWith(". إذا فضيت الساعة منخبرك.")).toBe(true);
    expect(message).not.toContain("https://ahmad.localhost/");
    expect(
      bookingRejectedMessage({
        name: "Ahmad",
        day: "Friday",
        time: "21:00",
        reason: "slot taken",
        link: "https://ahmad.localhost/",
        ending: "wait",
        locale: "en",
      }),
    ).toBe(
      `Hello ${embed("Ahmad")}, we can't confirm your booking on ${embed("Friday")} at ${embed("21:00")} (${embed("slot taken")}). We'll tell you if it frees up.`,
    );
  });
});

describe("cancel messages", () => {
  it("picks player, player-with-fee, and owner", () => {
    expect(
      bookingCancelledByPlayerMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "21:00",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، انلغى حجزك يوم ${embed("الجمعة")} الساعة ${embed("21:00")}.`,
    );
    expect(
      bookingCancelledByPlayerFeeMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "21:00",
        fee: "$15",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، انلغى حجزك يوم ${embed("الجمعة")} الساعة ${embed("21:00")}. رسوم الإلغاء ${embed("$15")}.`,
    );
    expect(
      bookingCancelledByOwnerMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "21:00",
        link: "https://ahmad.localhost/",
      }),
    ).toContain("اضطرينا نلغي حجزك");
  });

  it("isolates a Latin name, $10, and the time in an Arabic message", () => {
    const text = bookingCancelledByPlayerFeeMessage({
      name: "ali",
      day: "الجمعة، 25 أيلول",
      time: "10:00 مساءً",
      fee: "$10",
    });
    expect(text).toContain("\u2068ali\u2069");
    expect(text).toContain("\u2068$10\u2069");
    expect(text).toContain("\u206810:00 مساءً\u2069");
    expect(text).toBe(
      `مرحبا ${embed("ali")}، انلغى حجزك يوم ${embed("الجمعة، 25 أيلول")} الساعة ${embed("10:00 مساءً")}. رسوم الإلغاء ${embed("$10")}.`,
    );
  });
});

describe("no-show messages", () => {
  it("uses the Lebanese fee and no-fee bodies", () => {
    expect(
      bookingNoShowFeeMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "7:00 مساءً",
        fee: "$20",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، ما إجيت على حجزك يوم ${embed("الجمعة")} الساعة ${embed("7:00 مساءً")}. رسوم عدم الحضور ${embed("$20")}.`,
    );
    expect(
      bookingNoShowMessage({
        name: "أحمد",
        day: "الجمعة",
        time: "19:00",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، ما إجيت على حجزك يوم ${embed("الجمعة")} الساعة ${embed("19:00")}. نشوفك المرة الجاي!`,
    );
  });
});

describe("paymentReminderMessage", () => {
  it("names the amount and the date", () => {
    expect(
      paymentReminderMessage({
        name: "أحمد",
        amount: "$15",
        date: "الجمعة 25 أيلول",
      }),
    ).toBe(
      `مرحبا ${embed("أحمد")}، في عليك ${embed("$15")} من ${embed("الجمعة 25 أيلول")}. شكراً!`,
    );
  });
});
