import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { deriveCardDisplay } from "@/modules/booking/domain/card-display";

const price = new Decimal("30.00");

describe("deriveCardDisplay", () => {
  const start = new Date("2026-09-13T20:00:00.000Z"); // 23:00 Beirut
  const end = new Date("2026-09-13T21:30:00.000Z"); // 00:30 Beirut, next civil day

  it("shows the price before the start", () => {
    expect(
      deriveCardDisplay({
        start,
        end,
        price,
        remaining: price,
        now: new Date("2026-09-13T19:00:00.000Z"),
      }).kind,
    ).toBe("before");
  });

  it("stays live after midnight until the end, with minutes left", () => {
    const display = deriveCardDisplay({
      start,
      end,
      price,
      remaining: price,
      now: new Date("2026-09-13T21:10:00.000Z"), // 00:10 Beirut
    });
    expect(display).toEqual({ kind: "live", minutesLeft: 20 });
  });

  it("is unpaid once the window has ended and nothing was collected", () => {
    expect(
      deriveCardDisplay({
        start,
        end,
        price,
        remaining: price,
        now: new Date("2026-09-13T21:30:00.000Z"),
      }).kind,
    ).toBe("unpaid");
  });

  it("is partial when some of the price is still due", () => {
    expect(
      deriveCardDisplay({
        start,
        end,
        price,
        remaining: new Decimal("10.00"),
        now: new Date("2026-09-13T22:00:00.000Z"),
      }).kind,
    ).toBe("partial");
  });

  it("is paid when nothing remains after the end", () => {
    expect(
      deriveCardDisplay({
        start,
        end,
        price,
        remaining: new Decimal(0),
        now: new Date("2026-09-13T22:00:00.000Z"),
      }).kind,
    ).toBe("paid");
  });
});
