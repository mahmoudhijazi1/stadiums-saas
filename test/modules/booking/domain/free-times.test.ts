import { describe, expect, it } from "@jest/globals";
import { commonPriceUsd, freePitches, freeSlots } from "@/modules/booking/domain/free-times";

const slot = (priceUsd: string, available = true) => ({ priceUsd, available });

describe("commonPriceUsd", () => {
  it("is the price most of the free times have", () => {
    expect(commonPriceUsd([slot("20.00"), slot("25.00"), slot("20.00"), slot("20.00")])).toBe("20.00");
  });

  it("breaks a tie with the earliest time's price, and is null with no time", () => {
    expect(commonPriceUsd([slot("25.00"), slot("20.00")])).toBe("25.00");
    expect(commonPriceUsd([])).toBeNull();
  });
});

describe("free times", () => {
  it("drops taken times and the pitches left with none", () => {
    expect(freeSlots([slot("20.00"), slot("20.00", false)])).toHaveLength(1);
    const pitches = freePitches([
      { id: "a", slots: [slot("20.00", false)] },
      { id: "b", slots: [slot("20.00"), slot("30.00", false)] },
    ]);
    expect(pitches.map((pitch) => [pitch.id, pitch.slots.length])).toEqual([["b", 1]]);
  });

  it("counts only free times for the heading price (a taken time cannot set it)", () => {
    const [pitch] = freePitches([{ id: "a", slots: [slot("50.00", false), slot("50.00", false), slot("20.00")] }]);
    expect(commonPriceUsd(pitch!.slots)).toBe("20.00");
  });
});
