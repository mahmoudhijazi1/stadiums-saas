import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Seed crosses tenants, so it must use an UNSCOPED client (same idea as platformDb).
 * Do not import @/lib/db here — that client injects one request's tenantId.
 */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const platformDb = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // Clear existing demo data so re-running seed is safe
  await platformDb.pitch.deleteMany();
  await platformDb.tenant.deleteMany();

  await platformDb.tenant.create({
    data: {
      slug: "ahmad",
      name: "Ahmad Stadium",
      pitches: {
        create: [
          { name: "Pitch A1" },
          { name: "Pitch A2" },
          { name: "Pitch A3" },
        ],
      },
    },
  });

  await platformDb.tenant.create({
    data: {
      slug: "sami",
      name: "Sami Arena",
      pitches: {
        create: [{ name: "Pitch S1" }, { name: "Pitch S2" }],
      },
    },
  });

  console.log("Seeded tenants: ahmad (3 pitches), sami (2 pitches)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await platformDb.$disconnect();
    await pool.end();
  });
