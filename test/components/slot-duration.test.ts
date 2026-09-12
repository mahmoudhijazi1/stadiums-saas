import { describe, expect, it } from "@jest/globals";
import { formatSlotDuration } from "@/components/slot-picker";

describe("formatSlotDuration", () => {
  it("labels whole hours and 90-minute slots in Latin", () => {
    expect(
      formatSlotDuration(
        "2026-09-12T13:00:00.000Z",
        "2026-09-12T14:00:00.000Z",
      ),
    ).toBe("1h");
    expect(
      formatSlotDuration(
        "2026-09-12T13:00:00.000Z",
        "2026-09-12T14:30:00.000Z",
      ),
    ).toBe("1.5h");
    expect(
      formatSlotDuration(
        "2026-09-12T13:00:00.000Z",
        "2026-09-12T13:45:00.000Z",
      ),
    ).toBe("45m");
  });
});
