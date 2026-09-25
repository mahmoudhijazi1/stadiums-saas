import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  summarizeDay,
  type DaySummaryRow,
} from "@/modules/booking/domain/day-summary";

const price = new Decimal("30.00");
const zero = new Decimal("0.00");

function row(
  partial: Pick<DaySummaryRow, "status" | "start" | "end"> & {
    collectedUsd?: Decimal;
    amountDueUsd?: Decimal;
  },
): DaySummaryRow {
  return {
    amountDueUsd: price,
    collectedUsd: zero,
    ...partial,
  };
}

describe("summarizeDay", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");

  it("counts a cancelled remainder as owed, not as a game", () => {
    const summary = summarizeDay(
      [
        row({
          status: "CANCELLED",
          start: new Date("2026-09-24T13:00:00.000Z"),
          end: new Date("2026-09-24T14:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(summary.games).toBe(0);
    expect(summary.noShows).toBe(0);
    expect(summary.collectedUsd.toFixed(2)).toBe("0.00");
    expect(summary.owedUsd.toFixed(2)).toBe("30.00");
    expect(summary.expectedUsd.toFixed(2)).toBe("0.00");
  });

  it("counts an upcoming game as expected, not owed", () => {
    const summary = summarizeDay(
      [
        row({
          status: "APPROVED",
          start: new Date("2026-09-24T15:00:00.000Z"),
          end: new Date("2026-09-24T16:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(summary.games).toBe(1);
    expect(summary.expectedUsd.toFixed(2)).toBe("30.00");
    expect(summary.owedUsd.toFixed(2)).toBe("0.00");
  });

  it("counts an ended unpaid game as owed", () => {
    const summary = summarizeDay(
      [
        row({
          status: "APPROVED",
          start: new Date("2026-09-24T08:00:00.000Z"),
          end: new Date("2026-09-24T09:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(summary.games).toBe(1);
    expect(summary.owedUsd.toFixed(2)).toBe("30.00");
    expect(summary.expectedUsd.toFixed(2)).toBe("0.00");
  });

  it("counts an unpaid no-show as owed, not as a game", () => {
    const summary = summarizeDay(
      [
        row({
          status: "NO_SHOW",
          start: new Date("2026-09-24T15:00:00.000Z"),
          end: new Date("2026-09-24T16:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(summary.games).toBe(0);
    expect(summary.noShows).toBe(1);
    expect(summary.owedUsd.toFixed(2)).toBe("30.00");
    expect(summary.expectedUsd.toFixed(2)).toBe("0.00");
  });

  it("keeps an in-progress game in expected until it ends", () => {
    const summary = summarizeDay(
      [
        row({
          status: "APPROVED",
          start: new Date("2026-09-24T11:00:00.000Z"),
          end: new Date("2026-09-24T13:00:00.000Z"),
        }),
      ],
      now,
    );

    expect(summary.games).toBe(1);
    expect(summary.expectedUsd.toFixed(2)).toBe("30.00");
    expect(summary.owedUsd.toFixed(2)).toBe("0.00");
  });

  it("keeps money collected on a cancelled game in collected", () => {
    const summary = summarizeDay(
      [
        row({
          status: "CANCELLED",
          start: new Date("2026-09-24T08:00:00.000Z"),
          end: new Date("2026-09-24T09:00:00.000Z"),
          collectedUsd: price,
        }),
      ],
      now,
    );

    expect(summary.games).toBe(0);
    expect(summary.collectedUsd.toFixed(2)).toBe("30.00");
    expect(summary.owedUsd.toFixed(2)).toBe("0.00");
    expect(summary.expectedUsd.toFixed(2)).toBe("0.00");
  });

  it("treats a game that crosses midnight by its end instant", () => {
    const start = new Date("2026-09-13T20:00:00.000Z"); // 23:00 Beirut
    const end = new Date("2026-09-13T21:30:00.000Z"); // 00:30 Beirut, next day
    const playing = summarizeDay(
      [row({ status: "APPROVED", start, end })],
      new Date("2026-09-13T21:10:00.000Z"), // 00:10, still inside the window
    );
    const ended = summarizeDay(
      [row({ status: "APPROVED", start, end })],
      new Date("2026-09-13T21:30:00.000Z"),
    );

    expect(playing.games).toBe(1);
    expect(playing.expectedUsd.toFixed(2)).toBe("30.00");
    expect(playing.owedUsd.toFixed(2)).toBe("0.00");
    expect(ended.owedUsd.toFixed(2)).toBe("30.00");
    expect(ended.expectedUsd.toFixed(2)).toBe("0.00");
  });
});
