import { describe, expect, it } from "@jest/globals";
import { formatPhoneDisplay, isCanonicalPhone, normalizePhone, toCanonicalPhone, toLebanonNumber, toPhoneSearchDigits } from "@/modules/people/domain/phone";
import { COUNTRIES, DEFAULT_COUNTRY, isKnownCountry } from "@/modules/people/domain/countries";
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

/** Every input of the canonical and country tables, collected as those tables are declared. */
const contractInputs: [string, string?][] = [];

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
    contractInputs.push([input]);
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

describe("toCanonicalPhone with a country", () => {
  const rows: [string, string, string | null][] = [
    ["0933 123 456", "963", "963933123456"],
    ["933123456", "963", "963933123456"],
    ["963933123456", "963", "963933123456"],
    ["+961 71 123 456", "963", "96171123456"],
    ["0096171123456", "963", "96171123456"],
    ["71 123 456", "961", "96171123456"],
    ["933", "963", null],
    ["71123456", "999", null],
    ["06 12 34 56 78", "33", "33612345678"],
    ["2025550123", "1", "12025550123"],
  ];
  for (const [input, country, expected] of rows) {
    contractInputs.push([input, country]);
    it(`${JSON.stringify(input)} for ${country} -> ${JSON.stringify(expected)}`, () => {
      expect(toCanonicalPhone(input, country)).toBe(expected);
    });
  }

  it("keeps every call without a country exactly as before (Lebanon)", () => {
    expect(toCanonicalPhone("71123456")).toBe("96171123456");
    expect(toCanonicalPhone("03123456")).toBe("9613123456");
    expect(toCanonicalPhone("0933123456")).toBeNull();
  });

  it("contract: every non-null result is 10 to 15 digits only and is stable when read back as international", () => {
    for (const [input, country] of rows) {
      const result = toCanonicalPhone(input, country);
      if (result === null) continue;
      expect(result).toMatch(/^\d{10,15}$/);
      expect(toCanonicalPhone(`+${result}`)).toBe(result);
    }
  });
});

describe("countries", () => {
  it("starts with Lebanon as the default and knows only listed codes", () => {
    expect(COUNTRIES[0]).toEqual({ code: "961", key: "lb" });
    expect(DEFAULT_COUNTRY).toBe("961");
    expect(COUNTRIES.map((country) => country.code)).toEqual(["961", "963", "970", "962", "964", "20", "966", "971", "974", "965", "33", "49", "1"]);
    expect(isKnownCountry("963")).toBe(true);
    expect(isKnownCountry("999")).toBe(false);
    expect(isKnownCountry("")).toBe(false);
  });
});

describe("toCanonicalPhone: other countries with a prefix need 10 to 15 digits", () => {
  it("accepts a full international number and refuses the short ones", () => {
    expect(toCanonicalPhone("+12025550123")).toBe("12025550123");
    expect(toCanonicalPhone("+123456789")).toBeNull(); // 9 digits
    expect(toCanonicalPhone("+71123456")).toBeNull(); // 8 digits, not 961
    expect(toCanonicalPhone("+0123456789")).toBeNull(); // first digit 0
  });
});

describe("isCanonicalPhone", () => {
  it("is true for canonical numbers", () => {
    for (const value of ["96171123456", "9613123456", "963933123456", "12025550123"]) {
      expect(isCanonicalPhone(value)).toBe(true);
    }
  });

  it("is false for everything else, and converts nothing", () => {
    for (const value of ["71123456", "03123456", "0096171123456", "96112345678", "961123456", "123456789", "+96171123456", "", "96171abc456", " 96171123456"]) {
      expect(isCanonicalPhone(value)).toBe(false);
    }
  });

  it("contract: every value toCanonicalPhone returns, for every table row and country, is canonical", () => {
    expect(contractInputs.length).toBeGreaterThan(20);
    let checked = 0;
    for (const [input, country] of contractInputs) {
      const result = country === undefined ? toCanonicalPhone(input) : toCanonicalPhone(input, country);
      if (result === null) continue;
      checked += 1;
      expect(isCanonicalPhone(result)).toBe(true);
    }
    expect(checked).toBeGreaterThan(10);
  });
});
