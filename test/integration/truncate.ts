import { prismaBase } from "@/lib/prisma-base";

/**
 * Wipe all app tables on stadiums_test between cases.
 * Refuses to run unless STADIUMS_INTEGRATION=1 and DATABASE_URL names stadiums_test.
 */
const TABLES = [
  "BookingParticipant",
  "SlotInterest",
  "Booking",
  "PaymentTender",
  "Payment",
  "LedgerEntry",
  "Expense",
  "ExchangeRate",
  "UserPersonLink",
  "Membership",
  "Pitch",
  "Person",
  "Session",
  "User",
  "Tenant",
] as const;

export async function truncateAll(): Promise<void> {
  if (process.env.STADIUMS_INTEGRATION !== "1") {
    throw new Error("Refusing truncate: STADIUMS_INTEGRATION is not set");
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("/stadiums_test")) {
    throw new Error(
      "Refusing truncate: DATABASE_URL must point at database stadiums_test",
    );
  }

  const list = TABLES.map((name) => `"${name}"`).join(", ");
  await prismaBase.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}
