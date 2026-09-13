import { describe, expect, it } from "@jest/globals";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import { DomainError } from "@/lib/errors";

const ALL_WEEK = {
  days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  open: "16:00",
  close: "22:00",
};

describe("parsePitchDraft", () => {
  it("accepts hours groups and normalizes USD", () => {
    const draft = parsePitchDraft({
      name: "  A1  ",
      slotDurationMinutes: "60",
      defaultPriceUsd: "30",
      hoursGroups: JSON.stringify([
        { ...ALL_WEEK, open: "16:00:00", close: "22:00" },
      ]),
    });
    expect(draft.name).toBe("A1");
    expect(draft.hoursGroups[0]?.open).toBe("16:00");
    expect(draft.hoursGroups[0]?.close).toBe("22:00");
    expect(draft.slotDurationMinutes).toBe(60);
    expect(draft.defaultPriceUsd).toBe("30.00");
    expect(draft.confirmPending).toBe(false);
    expect(draft.priceRules).toEqual([]);
  });

  it("rejects close-before-open and treats confirmPending as on", () => {
    expect(() =>
      parsePitchDraft({
        name: "A1",
        slotDurationMinutes: 60,
        defaultPriceUsd: "30.00",
        hoursGroups: [{ days: ["mon"], open: "22:00", close: "16:00" }],
      }),
    ).toThrow();
    expect(
      parsePitchDraft({
        name: "A1",
        slotDurationMinutes: 90,
        defaultPriceUsd: "30.00",
        hoursGroups: [ALL_WEEK],
        confirmPending: "on",
      }).confirmPending,
    ).toBe(true);
  });

  it("parses day priceRules from JSON and drops a blank extra row", () => {
    const draft = parsePitchDraft({
      name: "A1",
      slotDurationMinutes: 60,
      defaultPriceUsd: "30.00",
      hoursGroups: [ALL_WEEK],
      priceRules: JSON.stringify([
        { days: ["sat", "fri"], priceUsd: "40" },
        { days: [], priceUsd: "" },
      ]),
    });
    expect(draft.priceRules).toEqual([
      { days: ["fri", "sat"], priceUsd: "40.00" },
    ]);
  });

  it("drops a blank hours row and rejects a day in two groups", () => {
    const draft = parsePitchDraft({
      name: "A1",
      slotDurationMinutes: 60,
      defaultPriceUsd: "30.00",
      hoursGroups: JSON.stringify([
        ALL_WEEK,
        { days: [], open: "16:00", close: "22:00" },
      ]),
    });
    expect(draft.hoursGroups).toHaveLength(1);
    expect(() =>
      parsePitchDraft({
        name: "A1",
        slotDurationMinutes: 60,
        defaultPriceUsd: "30.00",
        hoursGroups: [
          { days: ["fri", "sat"], open: "16:00", close: "22:00" },
          { days: ["fri"], open: "16:00", close: "23:00" },
        ],
      }),
    ).toThrow(new DomainError("venue.hours_day_overlap"));
  });
});
