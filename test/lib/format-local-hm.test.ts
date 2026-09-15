import { describe, expect, it } from "@jest/globals";
import { formatLocalHm } from "@/lib/format-local-hm";

describe("formatLocalHm", () => {
  it("formats HH:mm in Asia/Beirut", () => {
    // 2026-10-05 13:00 UTC = 16:00 Beirut (UTC+3)
    const instant = new Date("2026-10-05T13:00:00.000Z");
    expect(formatLocalHm(instant, "Asia/Beirut")).toBe("16:00");
  });

  it("maps hour 24 to 00 at local midnight", () => {
    // 2026-10-04 21:00 UTC = 00:00 Beirut next civil day
    const instant = new Date("2026-10-04T21:00:00.000Z");
    expect(formatLocalHm(instant, "Asia/Beirut")).toBe("00:00");
  });
});
