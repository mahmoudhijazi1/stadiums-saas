import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { classifyDue } from "@/modules/booking/domain/classify-due";
import { summarizeDay } from "@/modules/booking/domain/day-summary";
import { summarizePersonBookings } from "@/modules/booking/domain/person-stats";

const now = new Date("2026-09-24T12:00:00.000Z");
const price = new Decimal("30.00");
const zero = new Decimal("0.00");

describe("classifyDue", () => {
  it("owes an ended approved game with remaining", () => {
    expect(
      classifyDue({
        status: "APPROVED",
        start: new Date("2026-09-24T08:00:00.000Z"),
        end: new Date("2026-09-24T09:00:00.000Z"),
        remaining: price,
        now,
      }),
    ).toBe("owed");
  });

  it("expects an upcoming approved game", () => {
    expect(
      classifyDue({
        status: "APPROVED",
        start: new Date("2026-09-24T15:00:00.000Z"),
        end: new Date("2026-09-24T16:00:00.000Z"),
        remaining: price,
        now,
      }),
    ).toBe("expected");
  });

  it("expects an in-progress approved game", () => {
    expect(
      classifyDue({
        status: "APPROVED",
        start: new Date("2026-09-24T11:00:00.000Z"),
        end: new Date("2026-09-24T13:00:00.000Z"),
        remaining: price,
        now,
      }),
    ).toBe("expected");
  });

  it("owes a no-show with remaining, even before the end", () => {
    expect(
      classifyDue({
        status: "NO_SHOW",
        start: new Date("2026-09-24T15:00:00.000Z"),
        end: new Date("2026-09-24T16:00:00.000Z"),
        remaining: price,
        now,
      }),
    ).toBe("owed");
  });

  it("is none when nothing remains", () => {
    expect(
      classifyDue({
        status: "APPROVED",
        start: new Date("2026-09-24T08:00:00.000Z"),
        end: new Date("2026-09-24T09:00:00.000Z"),
        remaining: zero,
        now,
      }),
    ).toBe("none");
  });

  it("owes a cancelled booking that still has a fee", () => {
    expect(
      classifyDue({
        status: "CANCELLED",
        start: new Date("2026-09-24T08:00:00.000Z"),
        end: new Date("2026-09-24T09:00:00.000Z"),
        remaining: price,
        now,
      }),
    ).toBe("owed");
  });

  it("is none for a cancelled booking with nothing remaining", () => {
    expect(
      classifyDue({
        status: "CANCELLED",
        start: new Date("2026-09-24T08:00:00.000Z"),
        end: new Date("2026-09-24T09:00:00.000Z"),
        remaining: zero,
        now,
      }),
    ).toBe("none");
  });
});

describe("summarizeDay and person stats share classifyDue", () => {
  const start = new Date("2026-09-24T15:00:00.000Z");
  const end = new Date("2026-09-24T16:00:00.000Z");

  it("counts an upcoming game as expected in both, never owed", () => {
    const day = summarizeDay(
      [
        {
          status: "APPROVED",
          start,
          end,
          amountDueUsd: price,
          collectedUsd: zero,
        },
      ],
      now,
    );
    const person = summarizePersonBookings(
      [
        {
          status: "APPROVED",
          start,
          end,
          collectionMode: "WHOLE",
          isRequester: true,
          amountDueUsd: price,
          collectedUsd: zero,
          participantDueUsd: price,
          allocatedUsd: zero,
        },
      ],
      now,
    );

    expect(day.expectedUsd.toFixed(2)).toBe("30.00");
    expect(day.owedUsd.toFixed(2)).toBe("0.00");
    expect(person.expectedUsd.toFixed(2)).toBe("30.00");
    expect(person.owesNowUsd.toFixed(2)).toBe("0.00");
  });
});
