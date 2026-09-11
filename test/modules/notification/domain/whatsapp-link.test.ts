import { describe, expect, it } from "@jest/globals";
import {
  slotAvailableMessage,
  whatsAppHref,
} from "@/modules/notification/domain/whatsapp-link";

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
        "Phone cannot be used for WhatsApp",
      );
    },
  );
});

describe("slotAvailableMessage", () => {
  it("names the stadium, pitch, and local times", () => {
    expect(
      slotAvailableMessage({
        stadiumName: "Ahmad Stadium",
        pitchName: "Pitch 1",
        startLocal: "18:00",
        endLocal: "19:00",
      }),
    ).toBe(
      "Ahmad Stadium: Pitch 1 18:00–19:00 is free again if you still want it.",
    );
  });
});
