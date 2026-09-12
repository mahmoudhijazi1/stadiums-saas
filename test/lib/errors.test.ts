import { describe, expect, it } from "@jest/globals";
import { errorMessage } from "@/lib/error-messages";
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
    expect(errorMessage("booking.slot_ended")).toBe("هذه الساعة انتهت.");
    expect(errorMessage("booking.cancel_past_unpaid")).toBe(
      "لا يمكن إلغاء مباراة مضت وما زال عليها مبلغ.",
    );
  });

  it("returns catalog English when locale is en", () => {
    expect(errorMessage("booking.slot_ended", "en")).toBe("That hour has ended.");
    expect(errorMessage("booking.cancel_past_unpaid", "en")).toBe(
      "Cannot cancel a game that has started while money is still owed.",
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
