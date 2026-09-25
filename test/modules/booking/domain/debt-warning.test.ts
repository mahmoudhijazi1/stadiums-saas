import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  debtWarnings,
  type DebtParticipation,
} from "@/modules/booking/domain/debt-warning";

const now = new Date("2026-09-25T12:00:00.000Z");
const older = new Date("2026-09-20T13:00:00.000Z");
const newer = new Date("2026-09-24T13:00:00.000Z");
const future = new Date("2026-09-26T13:00:00.000Z");

function row(partial: Partial<DebtParticipation> & Pick<DebtParticipation, "personId" | "start" | "status">): DebtParticipation {
  return {
    bookingId: "b",
    end: new Date(partial.start.getTime() + 60 * 60 * 1000),
    collectionMode: "WHOLE",
    isRequester: true,
    bookingRemainingUsd: new Decimal("15.00"),
    participantRemainingUsd: new Decimal("0"),
    reason: null,
    ...partial,
  };
}

describe("debtWarnings", () => {
  it("sums owed fees and keeps the later booking's reason and date", () => {
    const warnings = debtWarnings(
      [
        row({
          personId: "ahmad",
          bookingId: "old",
          status: "CANCELLED",
          start: older,
          bookingRemainingUsd: new Decimal("10.00"),
          reason: "NO_SHOW_FEE",
        }),
        row({
          personId: "ahmad",
          bookingId: "new",
          status: "CANCELLED",
          start: newer,
          bookingRemainingUsd: new Decimal("15.00"),
          reason: "LATE_CANCELLATION_FEE",
        }),
        row({
          personId: "ahmad",
          bookingId: "soon",
          status: "APPROVED",
          start: future,
          bookingRemainingUsd: new Decimal("40.00"),
        }),
      ],
      now,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.totalUsd.equals("25.00")).toBe(true);
    expect(warnings[0]?.reason).toBe("LATE_CANCELLATION_FEE");
    expect(warnings[0]?.at).toEqual(newer);
  });

  it("ignores a person with only expected remaining", () => {
    expect(
      debtWarnings(
        [
          row({
            personId: "sami",
            status: "APPROVED",
            start: future,
          }),
        ],
        now,
      ),
    ).toEqual([]);
  });
});
