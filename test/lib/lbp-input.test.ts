import { describe, expect, it } from "@jest/globals";
import { toLbpDigits } from "@/components/ui/lbp-input";
import { groupedDigits } from "@/lib/ui-copy";

describe("LBP field text", () => {
  it("keeps plain digits whatever was typed or pasted", () => {
    expect(toLbpDigits("2,700,000")).toBe("2700000");
    expect(toLbpDigits("2 700 000 LBP")).toBe("2700000");
    expect(toLbpDigits("٢٬٧٠٠٬٠٠٠")).toBe("2700000");
    expect(toLbpDigits("۲۷۰۰۰۰۰")).toBe("2700000");
    expect(toLbpDigits("")).toBe("");
  });

  it("groups with commas for display", () => {
    expect(groupedDigits(toLbpDigits("2700000"))).toBe("2,700,000");
    expect(groupedDigits("900")).toBe("900");
    expect(groupedDigits("89500")).toBe("89,500");
  });
});
