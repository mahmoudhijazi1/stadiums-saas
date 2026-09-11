/**
 * Postgres exclusion (BR-24) — two APPROVED windows on the same pitch.
 * Prisma 7 + adapter-pg wraps the 23P01; walk cause / message, do not guess P2002.
 */
export function isExclusionViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 8 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = String((current as { code: unknown }).code);
      if (code === "23P01") return true;
    }
    const text =
      current instanceof Error
        ? `${current.message} ${current.stack ?? ""}`
        : String(current);
    if (
      text.includes("23P01") ||
      text.includes("Booking_approved_during_excl")
    ) {
      return true;
    }
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}
