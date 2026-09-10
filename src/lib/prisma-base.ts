import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * One Prisma client + one pool for the app.
 * - Tenant lookup / seeding → platformDb (same client, unscoped import)
 * - Normal queries → db (this client with the tenant extension)
 *
 * Do not import this from feature code. Do not create a second PrismaClient
 * on this pool — PrismaPg assumes exclusive use; a second client + $transaction
 * terminates sockets.
 */
const globalForPrisma = globalThis as unknown as {
  stadiumPg?: { pool: pg.Pool };
  prismaBaseSingle?: PrismaClient;
};

function createPrismaBase() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Drop the Chapter 19 dual-client pool if this process still has it (HMR).
if (globalForPrisma.stadiumPg && !globalForPrisma.prismaBaseSingle) {
  void globalForPrisma.stadiumPg.pool.end().catch(() => undefined);
  globalForPrisma.stadiumPg = undefined;
}

export const prismaBase = globalForPrisma.prismaBaseSingle ?? createPrismaBase();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBaseSingle = prismaBase;
}
