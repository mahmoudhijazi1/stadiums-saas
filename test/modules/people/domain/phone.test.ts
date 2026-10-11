import { describe, expect, it } from "@jest/globals";
import { formatPhoneDisplay, normalizePhone, toCanonicalPhone, toLebanonNumber, toPhoneSearchDigits } from "@/modules/people/domain/phone";
import { whatsAppChatHref } from "@/modules/notification/domain/whatsapp-link";

describe("normalizePhone", () => {
  it("strips spaces, dashes, and + so the same number is one person", () => {
    expect(normalizePhone("03 123 456")).toBe("03123456");
    expect(normalizePhone("03-123-456")).toBe("03123456");
    expect(normalizePhone("+961 3 123456")).toBe("9613123456");
  });

  it("is a no-op when the value is already digits", () => {
    expect(normalizePhone("03123456")).toBe("03123456");
  });
});

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

describe("formatPhoneDisplay", () => {
  it("spaces an 8-digit mobile after 961", () => {
    expect(formatPhoneDisplay("96171123456")).toBe("+961 71 123 456");
  });

  it("spaces a 7-digit number after 961", () => {
    expect(formatPhoneDisplay("9613123456")).toBe("+961 3 123 456");
  });

  it("returns anything else unchanged: no 961 prefix, a local 0 number, empty", () => {
    expect(formatPhoneDisplay("03123456")).toBe("03123456");
    expect(formatPhoneDisplay("71123456")).toBe("71123456");
    expect(formatPhoneDisplay("")).toBe("");
  });

  it("returns an already formatted or non-digit input unchanged", () => {
    expect(formatPhoneDisplay("+961 71 123 456")).toBe("+961 71 123 456");
    expect(formatPhoneDisplay("961abc12345")).toBe("961abc12345");
  });

  it("returns a 961 number of any other length unchanged", () => {
    expect(formatPhoneDisplay("961123456")).toBe("961123456"); // 6 digits after 961
    expect(formatPhoneDisplay("961123456789")).toBe("961123456789"); // 9 digits after 961
  });

  it("leaves the raw digits for links: the function does not change what normalizePhone stores", () => {
    expect(normalizePhone("+961 71 123 456")).toBe("96171123456");
    expect(toLebanonNumber("96171123456")).toBe("96171123456");
  });
});

describe("toCanonicalPhone", () => {
  const rows: [string, string | null][] = [
    ["0096171123456", "96171123456"],
    ["+961 71 123 456", "96171123456"],
    ["96171123456", "96171123456"],
    ["71123456", "96171123456"],
    ["71 123 456", "96171123456"],
    ["03123456", "9613123456"],
    ["3123456", "9613123456"],
    ["+961 03 123 456", "9613123456"],
    ["9611234", "9619611234"],
    ["+963933123456", "963933123456"],
    ["00963933123456", "963933123456"],
    ["0933123456", null],
    ["61123456", null],
    ["", null],
    ["abc", null],
    ["71123abc", null],
    ["\u0667\u0661\u0661\u0662\u0663\u0664\u0665\u0666", "96171123456"],
    ["+1234567890123456", null], // 16 digits
  ];
  for (const [input, expected] of rows) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(toCanonicalPhone(input)).toBe(expected);
    });
  }
});

describe("toPhoneSearchDigits", () => {
  it("converts digits and drops a leading 00 or one leading 0", () => {
    expect(toPhoneSearchDigits("\u0667\u0661\u0661\u0662\u0663")).toBe("71123");
    expect(toPhoneSearchDigits("0312")).toBe("312");
    expect(toPhoneSearchDigits("0096171")).toBe("96171");
  });

  it("never throws", () => {
    expect(toPhoneSearchDigits("")).toBe("");
    expect(toPhoneSearchDigits("abc")).toBe("");
    expect(toPhoneSearchDigits("+")).toBe("");
  });
});

describe("formatPhoneDisplay: other countries", () => {
  it("puts a + on a canonical foreign number", () => {
    expect(formatPhoneDisplay("963933123456")).toBe("+963933123456");
  });
});
