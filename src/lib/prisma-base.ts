import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * One Prisma client + one pool for the app.
 * - Tenant / User / Session / seeding → platformDb (same client, unscoped import)
 * - Membership and other tenant-owned models → db (this client + tenant extension)
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

/** Cached client from before the last `prisma generate` has no new delegates (e.g. expense). */
function isCurrentGeneratedClient(client: PrismaClient): boolean {
  return typeof (client as { expense?: { findMany?: unknown } }).expense?.findMany ===
    "function";
}

function getPrismaBase(): PrismaClient {
  const existing = globalForPrisma.prismaBaseSingle;
  if (existing && isCurrentGeneratedClient(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect().catch(() => undefined);
    globalForPrisma.prismaBaseSingle = undefined;
  }
  const created = createPrismaBase();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaBaseSingle = created;
  }
  return created;
}

// Drop the Chapter 19 dual-client pool if this process still has it (HMR).
if (globalForPrisma.stadiumPg && !globalForPrisma.prismaBaseSingle) {
  void globalForPrisma.stadiumPg.pool.end().catch(() => undefined);
  globalForPrisma.stadiumPg = undefined;
}

export const prismaBase = getPrismaBase();
