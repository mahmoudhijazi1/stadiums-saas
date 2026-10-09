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
// Tenant hosts in tests are <slug>.lebstads.test (request-stubs.setTenantSlug).
process.env.APP_BASE_DOMAIN = "lebstads.test";
// Public page links (the QR code) are built with this scheme; CI has no .env to supply it.
process.env.APP_PROTOCOL = "http";
process.env.TRUST_PROXY_HEADERS = "";
// Web push: a throwaway VAPID pair, so the "configured" paths run. The sender is always a fake.
process.env.VAPID_PUBLIC_KEY = "BHeDxk40V_VmEoDksncIvL-EPPgu9kRGpuh8hZFmBlSzMdAZF_7KRC3qJqTPalJi-Xj7H25lTNxJQFbcsuue5b4";
process.env.VAPID_PRIVATE_KEY = "xGdrZRlYJ01Wo07Jn2A6R-5lz1AlV2OxgHf9kxe3F3A";
process.env.VAPID_SUBJECT = "mailto:ops@lebstads.test";
