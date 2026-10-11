import { describe, expect, it } from "@jest/globals";
import { groupByPeriod, periodOf } from "@/modules/booking/domain/day-periods";

describe("periodOf", () => {
  it("evening is 17:00 up to the business-day start, afternoon 12:00-16:59, morning the rest", () => {
    expect(periodOf(17, 6)).toBe("evening");
    expect(periodOf(23, 6)).toBe("evening");
    expect(periodOf(0, 6)).toBe("evening"); // a 00:30 game still belongs to last night
    expect(periodOf(5, 6)).toBe("evening");
    expect(periodOf(6, 6)).toBe("morning");
    expect(periodOf(11, 6)).toBe("morning");
    expect(periodOf(12, 6)).toBe("afternoon");
    expect(periodOf(16, 6)).toBe("afternoon");
  });
});

describe("groupByPeriod", () => {
  it("puts evening first, hides empty groups and keeps the order inside a group", () => {
    const groups = groupByPeriod([9, 13, 18, 19, 1], (hour) => hour, 6);
    expect(groups.map((group) => group.period)).toEqual(["evening", "afternoon", "morning"]);
    expect(groups[0]!.items).toEqual([18, 19, 1]);
    expect(groupByPeriod([18], (hour) => hour, 6).map((group) => group.period)).toEqual(["evening"]);
  });
});
