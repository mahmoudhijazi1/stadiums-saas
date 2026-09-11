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
  it("returns catalog English for a known key", () => {
    expect(errorMessage("booking.slot_ended")).toBe(
      "That hour has already ended.",
    );
  });

  it("returns generic English for an unknown key or legacy 1", () => {
    expect(errorMessage("not.a.real.key")).toBe(
      "Something went wrong. Try again.",
    );
    expect(errorMessage("1")).toBe("Something went wrong. Try again.");
  });
});
