import { describe, expect, it } from "@jest/globals";
import { isWaitlistWindowOpen } from "@/modules/booking/domain/waitlist";

const pitch = "pitch-1";
const window = {
  pitchId: pitch,
  start: new Date("2026-09-12T15:00:00.000Z"),
  end: new Date("2026-09-12T16:00:00.000Z"),
};
const before = new Date("2026-09-12T14:00:00.000Z");

describe("isWaitlistWindowOpen", () => {
  it("is open when nothing occupies the hour and it has not ended", () => {
    expect(
      isWaitlistWindowOpen({ window, occupied: [], now: before }),
    ).toBe(true);
  });

  it("is closed when an APPROVED range overlaps on the same pitch", () => {
    expect(
      isWaitlistWindowOpen({
        window,
        occupied: [
          {
            pitchId: pitch,
            start: new Date("2026-09-12T15:30:00.000Z"),
            end: new Date("2026-09-12T16:30:00.000Z"),
          },
        ],
        now: before,
      }),
    ).toBe(false);
  });

  it("stays open when the occupied list omits CANCELLED (not occupied)", () => {
    expect(
      isWaitlistWindowOpen({
        window,
        occupied: [
          {
            pitchId: "other-pitch",
            start: window.start,
            end: window.end,
          },
        ],
        now: before,
      }),
    ).toBe(true);
  });

  it("is closed when the window has already ended", () => {
    expect(
      isWaitlistWindowOpen({
        window,
        occupied: [],
        now: new Date("2026-09-12T16:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
