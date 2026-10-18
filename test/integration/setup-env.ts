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

// Name this run's connections in pg_stat_activity, so a second writer on stadiums_test can be told apart.
const named = new URL(testUrl);
named.searchParams.set("application_name", `jest-integration-${process.pid}`);
process.env.DATABASE_URL = named.toString();
process.env.STADIUMS_INTEGRATION = "1";
// Tenant hosts in tests are <slug>.lebstads.test (request-stubs.setTenantSlug).
process.env.APP_BASE_DOMAIN = "lebstads.test";
// Public page links (the QR code) are built with this scheme; CI has no .env to supply it.
process.env.APP_PROTOCOL = "http";
process.env.TRUST_PROXY_HEADERS = "";
// Password hashing at the cheapest cost src/lib/env.ts accepts (14), unless the environment sets one:
// a full run hashes hundreds of passwords (login-rate-limit alone makes dozens) and timed out under load.
process.env.PASSWORD_HASH_COST ??= "14";
// Web push: a throwaway VAPID pair, so the "configured" paths run. The sender is always a fake.
process.env.VAPID_PUBLIC_KEY = "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4";
process.env.VAPID_PRIVATE_KEY = "xGdrZRlYJ01Wo07Jn2A6R-5lz1AlV2OxgHf9kxe3F3A";
process.env.VAPID_SUBJECT = "mailto:ops@lebstads.test";
// Platform admin (DR-006): a throwaway TOTP key (32 bytes of 7), used nowhere else.
process.env.PLATFORM_TOTP_KEY = Buffer.alloc(32, 7).toString("base64");
