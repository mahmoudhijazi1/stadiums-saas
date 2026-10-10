import { describe, expect, it } from "@jest/globals";
import { errorMessage } from "@/lib/copy/errors";
import { DomainError, UnexpectedError } from "@/lib/errors";

describe("DomainError", () => {
  it("carries a message key, not UI copy", () => {
    const error = new DomainError("booking.slot_ended");
    expect(error).toBeInstanceOf(Error);
    expect(error.key).toBe("booking.slot_ended");
    expect(error.message).toBe("booking.slot_ended");
  });
});

describe("UnexpectedError", () => {
  it("wraps the original error as cause", () => {
    const cause = new Error("prisma boom");
    const error = new UnexpectedError(cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.cause).toBe(cause);
    expect(error.message).toBe("prisma boom");
  });
});

describe("errorMessage", () => {
  it("returns catalog Arabic for a known key", () => {
    expect(errorMessage("booking.no_longer_pending")).toBe("تم حجز هذه الساعة للتو");
    expect(errorMessage("booking.no_longer_pending", "en")).toBe(
      "This hour was just booked",
    );
    expect(errorMessage("booking.slot_ended")).toBe("هذه الساعة انتهت.");
    expect(errorMessage("booking.cancel_started")).toBe(
      "لا يمكن إلغاء مباراة بدأت. إذا لم تحدث، سجّل «لم يحضر».",
    );
    expect(errorMessage("venue.hours_approved")).toBe(
      "لا يمكن تقليص الساعات: هناك حجز مؤكد في الوقت المحذوف.",
    );
  });

  it("returns catalog English when locale is en", () => {
    expect(errorMessage("booking.slot_ended", "en")).toBe("That hour has ended.");
    expect(errorMessage("booking.cancel_started", "en")).toBe(
      "A game that has started can't be cancelled. If it didn't happen, record a no-show.",
    );
    expect(errorMessage("venue.hours_day_overlap", "en")).toBe(
      "A day cannot be in two hours groups.",
    );
    expect(errorMessage("booking.no_show_only_approved", "en")).toBe(
      "Only a confirmed booking can be marked no-show.",
    );
  });

  it("returns generic Arabic for an unknown key or legacy 1", () => {
    expect(errorMessage("not.a.real.key")).toBe("حدث خطأ. حاول مرة أخرى.");
    expect(errorMessage("1")).toBe("حدث خطأ. حاول مرة أخرى.");
  });

  it("returns generic English for an unknown key or legacy 1", () => {
    expect(errorMessage("not.a.real.key", "en")).toBe(
      "Something went wrong. Try again.",
    );
    expect(errorMessage("1", "en")).toBe("Something went wrong. Try again.");
  });
});
