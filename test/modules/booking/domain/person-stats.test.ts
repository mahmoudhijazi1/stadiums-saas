import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  summarizePersonBookings,
  type PersonStatRow,
} from "@/modules/booking/domain/person-stats";
import { personPaidOnBooking } from "@/modules/booking/domain/person-owed";

const now = new Date("2026-09-24T12:00:00.000Z");
const past = new Date("2026-09-23T13:00:00.000Z");
const future = new Date("2026-09-24T16:00:00.000Z");

function row(partial: Partial<PersonStatRow> & Pick<PersonStatRow, "status" | "start">): PersonStatRow {
  return {
    end: new Date(partial.start.getTime() + 60 * 60 * 1000),
    collectionMode: "WHOLE",
    isRequester: true,
    amountDueUsd: new Decimal("30.00"),
    collectedUsd: new Decimal("0.00"),
    participantDueUsd: new Decimal("30.00"),
    allocatedUsd: new Decimal("0.00"),
    ...partial,
  };
}

describe("personPaidOnBooking", () => {
  it("puts whole-game collections on the requester only", () => {
    expect(
      personPaidOnBooking({
        collectionMode: "WHOLE",
        isRequester: true,
        collectedUsd: new Decimal("30.00"),
        allocatedUsd: new Decimal("0"),
      }).equals("30.00"),
    ).toBe(true);
    expect(
      personPaidOnBooking({
        collectionMode: "WHOLE",
        isRequester: false,
        collectedUsd: new Decimal("30.00"),
        allocatedUsd: new Decimal("4.29"),
      }).equals(0),
    ).toBe(true);
  });
});

describe("summarizePersonBookings", () => {
  it("owes a past approved game and an unpaid cancellation, and expects a future game", () => {
    const stats = summarizePersonBookings(
      [
        row({ status: "APPROVED", start: past }),
        row({
          status: "NO_SHOW",
          start: past,
          collectedUsd: new Decimal("30.00"),
        }),
        row({ status: "APPROVED", start: future }),
        row({ status: "CANCELLED", start: past }),
      ],
      now,
    );

    expect(stats.gamesPlayed).toBe(1);
    expect(stats.noShows).toBe(1);
    expect(stats.totalPaidUsd.equals("30.00")).toBe(true);
    expect(stats.owesNowUsd.equals("60.00")).toBe(true);
    expect(stats.expectedUsd.equals("30.00")).toBe(true);
  });

  it("owes a per-player remainder, not the booking price", () => {
    const stats = summarizePersonBookings(
      [
        row({
          status: "APPROVED",
          start: past,
          collectionMode: "PER_PLAYER",
          isRequester: false,
          participantDueUsd: new Decimal("4.29"),
          allocatedUsd: new Decimal("1.00"),
          collectedUsd: new Decimal("30.00"),
        }),
      ],
      now,
    );

    expect(stats.gamesPlayed).toBe(1);
    expect(stats.totalPaidUsd.equals("1.00")).toBe(true);
    expect(stats.owesNowUsd.equals("3.29")).toBe(true);
    expect(stats.expectedUsd.equals("0.00")).toBe(true);
  });
});