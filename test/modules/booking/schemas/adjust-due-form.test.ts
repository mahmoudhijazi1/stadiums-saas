import { describe, expect, it } from "@jest/globals";
import { parseAdjustDueForm } from "@/modules/booking/schemas/adjust-due-form";

/**
 * DR-007 slice 8: the adjust form sends the amount in the game's currency, exactly one of toUsd and
 * toLbp; the one the form did not render arrives empty. Written, not run when authored.
 */
const base = { bookingId: "bk1", reason: "DISCOUNT", note: "" };

describe("the adjust-due form", () => {
  it("a game in dollars sends toUsd, normalised to two decimals, with an empty toLbp", () => {
    const parsed = parseAdjustDueForm({ ...base, toUsd: "25", toLbp: "" });
    expect([parsed.toUsd, parsed.toLbp, parsed.note]).toEqual(["25.00", undefined, null]);
  });

  it("a game in pounds sends toLbp in whole pounds, with an empty toUsd", () => {
    const parsed = parseAdjustDueForm({ ...base, toUsd: "", toLbp: "1500000" });
    expect([parsed.toUsd, parsed.toLbp]).toEqual([undefined, "1500000"]);
  });

  it("a field that is absent counts as empty", () => {
    expect(parseAdjustDueForm({ ...base, toLbp: "90000" }).toLbp).toBe("90000");
  });

  it("refuses no amount, both amounts, and amounts that are not valid for their currency", () => {
    expect(() => parseAdjustDueForm({ ...base, toUsd: "", toLbp: "" })).toThrow();
    expect(() => parseAdjustDueForm({ ...base, toUsd: "25", toLbp: "1500000" })).toThrow();
    expect(() => parseAdjustDueForm({ ...base, toLbp: "1500000.5" })).toThrow();
    expect(() => parseAdjustDueForm({ ...base, toLbp: "1,500,000" })).toThrow();
    expect(() => parseAdjustDueForm({ ...base, toUsd: "25.5" })).toThrow();
  });

  it("keeps the reasons and the note rules", () => {
    expect(() => parseAdjustDueForm({ ...base, toUsd: "25", reason: "EXTENSION" })).toThrow();
    expect(parseAdjustDueForm({ ...base, toUsd: "25", note: " late " }).note).toBe("late");
  });
});
