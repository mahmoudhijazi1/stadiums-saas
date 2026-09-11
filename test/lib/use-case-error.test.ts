import { describe, expect, it } from "@jest/globals";
import { z } from "zod";
import { DomainError, UnexpectedError } from "@/lib/errors";
import { actionErrorKey } from "@/lib/use-case-error";

describe("actionErrorKey", () => {
  it("returns the DomainError key", async () => {
    await expect(
      actionErrorKey(new DomainError("booking.slot_ended"), "submitPublicSlotRequest"),
    ).resolves.toBe("booking.slot_ended");
  });

  it("maps ZodError to form.invalid", async () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    await expect(actionErrorKey(parsed.error, "submitLogin")).resolves.toBe(
      "form.invalid",
    );
  });

  it("maps UnexpectedError to error.generic", async () => {
    await expect(
      actionErrorKey(new UnexpectedError(new Error("boom")), "submitLogin"),
    ).resolves.toBe("error.generic");
  });
});
