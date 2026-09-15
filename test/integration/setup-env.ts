/**
 * Runs before any test file. Forces the app Prisma pool onto stadiums_test.
 * Must not import @/lib/db here — only set env.
 */
import { config } from "dotenv";

config();

const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl?.includes("/stadiums_test")) {
  throw new Error(
    "Integration tests require DATABASE_URL_TEST pointing at database stadiums_test. " +
      "See .env.example and: docker compose up -d",
  );
}

process.env.DATABASE_URL = testUrl;
process.env.STADIUMS_INTEGRATION = "1";
