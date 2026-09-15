/**
 * Apply migrations to stadiums_test before integration Jest.
 * Requires Docker Postgres (see docker-compose.yml) and DATABASE_URL_TEST in .env.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl?.includes("/stadiums_test")) {
  throw new Error(
    "DATABASE_URL_TEST must point at database stadiums_test. " +
      "See .env.example and: docker compose up -d",
  );
}

execSync("npx prisma migrate deploy --config prisma7.config.ts", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});

console.log("Migrations applied on stadiums_test");
