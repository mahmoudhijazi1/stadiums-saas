import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  assertCanPaySlot,
  assertCanSwitchToPerPlayer,
  assertCanSwitchToWhole,
} from "@/modules/booking/domain/switch-mode";

const ok = {
  status: "APPROVED",
  collectionMode: "WHOLE" as const,
  amountDueUsd: new Decimal("30.00"),
  allocationCount: 0,
};

function key(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return (error as { key?: string }).key ?? "other";
  }
}

describe("assertCanSwitchToPerPlayer", () => {
  it("allows an approved whole booking with a due", () => {
    expect(key(() => assertCanSwitchToPerPlayer(ok))).toBeNull();
  });

  it("refuses CANCELLED and NO_SHOW with the fee error", () => {
    for (const status of ["CANCELLED", "NO_SHOW"]) {
      expect(key(() => assertCanSwitchToPerPlayer({ ...ok, status }))).toBe(
        "booking.switch_fee_booking",
      );
    }
  });

  it("refuses other statuses, a zero due, and an already split booking", () => {
    expect(key(() => assertCanSwitchToPerPlayer({ ...ok, status: "PENDING" }))).toBe(
      "booking.switch_not_approved",
    );
    expect(
      key(() => assertCanSwitchToPerPlayer({ ...ok, amountDueUsd: new Decimal(0) })),
    ).toBe("booking.switch_no_due");
    expect(
      key(() => assertCanSwitchToPerPlayer({ ...ok, collectionMode: "PER_PLAYER" })),
    ).toBe("booking.switch_not_whole");
  });
});

describe("assertCanSwitchToWhole", () => {
  it("needs PER_PLAYER and zero allocations", () => {
    expect(
      key(() => assertCanSwitchToWhole({ collectionMode: "PER_PLAYER", allocationCount: 0 })),
    ).toBeNull();
    expect(
      key(() => assertCanSwitchToWhole({ collectionMode: "PER_PLAYER", allocationCount: 1 })),
    ).toBe("booking.switch_has_allocations");
    expect(
      key(() => assertCanSwitchToWhole({ collectionMode: "WHOLE", allocationCount: 0 })),
    ).toBe("booking.switch_not_per_player");
  });
});

describe("assertCanPaySlot", () => {
  const slot = {
    status: "APPROVED",
    collectionMode: "PER_PLAYER" as const,
    slotRemainingUsd: new Decimal("3.00"),
  };

  it("checks the slot remaining, not the booking remaining", () => {
    expect(key(() => assertCanPaySlot(slot))).toBeNull();
  });

  it("refuses NO_SHOW and CANCELLED (those collapse to whole first)", () => {
    for (const status of ["NO_SHOW", "CANCELLED"]) {
      expect(key(() => assertCanPaySlot({ ...slot, status }))).toBe(
        "payment.collect_unapproved",
      );
    }
  });

  it("refuses a paid slot (double tap) and a booking that is not approved", () => {
    expect(
      key(() => assertCanPaySlot({ ...slot, slotRemainingUsd: new Decimal(0) })),
    ).toBe("payment.nothing_due");
    expect(key(() => assertCanPaySlot({ ...slot, status: "PENDING" }))).toBe(
      "payment.collect_unapproved",
    );
    expect(key(() => assertCanPaySlot({ ...slot, collectionMode: "WHOLE" }))).toBe(
      "booking.switch_not_per_player",
    );
  });
});
