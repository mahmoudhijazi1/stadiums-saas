import { describe, expect, it } from "@jest/globals";
import {
  collectUsdLabel,
  confirmedCount,
  dueRemainingLine,
  lbpPerUsdLine,
  pendingCount,
  ui,
} from "@/lib/ui-copy";

describe("ui", () => {
  it("returns catalog Arabic for a known key", () => {
    expect(ui("login.submit")).toBe("دخول");
    expect(ui("public.request")).toBe("اطلب");
    expect(ui("public.today")).toBe("اليوم");
    expect(ui("public.tomorrow")).toBe("غداً");
  });

  it("returns the key itself when unknown", () => {
    expect(ui("not.a.real.key")).toBe("not.a.real.key");
  });
});

describe("interpolated chrome", () => {
  it("uses Western digits and a Latin money amount", () => {
    expect(pendingCount(3)).toBe("قيد الانتظار · 3");
    expect(confirmedCount(0)).toBe("مؤكد · 0");
    expect(collectUsdLabel("30.00")).toBe("تحصيل $30.00");
    expect(dueRemainingLine("30.00", "10.00")).toBe(
      "المستحق $30.00 · المتبقي $10.00",
    );
    expect(lbpPerUsdLine("90000")).toBe("90000 ليرة لكل دولار");
  });
});
