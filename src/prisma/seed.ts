import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type ScheduleConfig,
  type Weekday,
} from "../modules/venue/schemas/schedule-config";
import { logger } from "../lib/logger";

/**
 * Seed crosses tenants, so it must use an UNSCOPED client (same idea as platformDb).
 * Do not import @/lib/db here — that client injects one request's tenantId.
 * Parse schedule_config with Zod before every write (DR-002 §2.4).
 */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const platformDb = new PrismaClient({ adapter: new PrismaPg(pool) });

const EVENING = [{ start: "16:00", end: "22:00" }];
const LONG_EVENING = [{ start: "16:00", end: "23:00" }];

function hours(
  open: Partial<Record<Weekday, { start: string; end: string }[]>>,
): ScheduleConfig["hours"] {
  return { ...CLOSED_WEEK_SCHEDULE.hours, ...open };
}

function config(input: unknown): ScheduleConfig {
  return parseScheduleConfig(input);
}

const ahmadA1 = config({
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: hours({
    mon: EVENING,
    tue: EVENING,
    wed: EVENING,
    thu: EVENING,
    fri: LONG_EVENING,
    sat: LONG_EVENING,
  }),
  defaultPriceUsd: "30.00",
  priceRules: [{ days: ["fri", "sat"], priceUsd: "40.00" }],
});

const ahmadA2 = config({
  slotDurationMinutes: 90,
  gapMinutes: 0,
  hours: hours({
    mon: EVENING,
    tue: EVENING,
    wed: EVENING,
    thu: EVENING,
  }),
  defaultPriceUsd: "35.00",
  priceRules: [],
});

const ahmadA3 = config({
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: hours({
    mon: [{ start: "10:00", end: "14:00" }],
  }),
  defaultPriceUsd: "20.00",
  priceRules: [],
});

const samiS1 = config({
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: hours({
    mon: [{ start: "18:00", end: "22:00" }],
    tue: [{ start: "18:00", end: "22:00" }],
    wed: [{ start: "18:00", end: "22:00" }],
    thu: [{ start: "18:00", end: "22:00" }],
    fri: [{ start: "18:00", end: "22:00" }],
    sat: [{ start: "18:00", end: "22:00" }],
  }),
  defaultPriceUsd: "25.00",
  priceRules: [],
});

const samiS2 = config({
  slotDurationMinutes: 60,
  gapMinutes: 0,
  hours: hours({
    sat: [{ start: "09:00", end: "12:00" }],
  }),
  defaultPriceUsd: "15.00",
  priceRules: [],
});

async function main() {
  await platformDb.pitch.deleteMany();
  await platformDb.tenant.deleteMany();

  await platformDb.tenant.create({
    data: {
      slug: "ahmad",
      name: "Ahmad Stadium",
      pitches: {
        create: [
          { name: "Pitch A1", scheduleConfig: ahmadA1 },
          { name: "Pitch A2", scheduleConfig: ahmadA2 },
          { name: "Pitch A3", scheduleConfig: ahmadA3 },
        ],
      },
    },
  });

  await platformDb.tenant.create({
    data: {
      slug: "sami",
      name: "Sami Arena",
      pitches: {
        create: [
          { name: "Pitch S1", scheduleConfig: samiS1 },
          { name: "Pitch S2", scheduleConfig: samiS2 },
        ],
      },
    },
  });

  logger.info("Seeded tenants: ahmad (3 pitches), sami (2 pitches) with schedule_config");
}

main()
  .catch((error) => {
    logger.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await platformDb.$disconnect();
    await pool.end();
  });
