import { describe, expect, it } from "@jest/globals";
import { toLebanonNumber } from "@/lib/lebanon-phone";
import { whatsAppChatHref } from "@/modules/notification/domain/whatsapp-link";

/** Written, not run when authored. One Lebanese-number rule for links and published phones. */
describe("toLebanonNumber", () => {
  it("turns a local 0-prefixed number into 961…", () => {
    expect(toLebanonNumber("03123456")).toBe("9613123456");
    expect(toLebanonNumber("71123456")).toBe("96171123456");
  });

  it("keeps a number that already starts with 961", () => {
    expect(toLebanonNumber("9613123456")).toBe("9613123456");
  });

  it("refuses anything that is not digits or is too short", () => {
    expect(toLebanonNumber("")).toBeNull();
    expect(toLebanonNumber("03 123 456")).toBeNull();
    expect(toLebanonNumber("+9613123456")).toBeNull();
    expect(toLebanonNumber("abc")).toBeNull();
    expect(toLebanonNumber("0312")).toBeNull();
  });

  it("is the rule the WhatsApp chat link uses", () => {
    expect(whatsAppChatHref("03123456")).toBe("https://wa.me/9613123456");
    expect(() => whatsAppChatHref("0312")).toThrow();
  });
});
