import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * One shared Prisma client + connection pool for the whole app.
 * Do not import this from feature code directly.
 * - Tenant lookup / seeding → platformDb
 * - Normal app queries (Step 4+) → db (will gain tenant scoping)
 */
const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

function createPrismaBase() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prismaBase = globalForPrisma.prismaBase ?? createPrismaBase();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
}
