import { describe, expect, it } from "@jest/globals";
import { availabilityLevel } from "@/modules/venue/domain/availability-level";

describe("availabilityLevel", () => {
  it("maps the free count to an empty ring, one, two or three dots", () => {
    expect([0, 1, 2, 3, 4, 20].map(availabilityLevel)).toEqual([0, 1, 2, 2, 3, 3]);
    expect(availabilityLevel(-1)).toBe(0);
  });
});
