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
  prismaPool?: pg.Pool;
  prismaBaseSingle?: PrismaClient;
};

/** Module-local handle. A per-file Jest realm can drop globalThis between files. */
let activePool: pg.Pool | undefined;

function createPrismaBase() {
  const max = Number(process.env.PG_POOL_MAX ?? "10");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.isFinite(max) && max > 0 ? max : 10,
  });
  activePool = pool;
  globalForPrisma.prismaPool = pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

/** Close the pg pool. Prisma $disconnect leaves an external pool open. */
export async function endPrismaPool(): Promise<void> {
  const pool = activePool ?? globalForPrisma.prismaPool;
  activePool = undefined;
  globalForPrisma.prismaPool = undefined;
  if (!pool) return;
  await pool.end();
}

type RuntimeField = { name: string };

/**
 * Cached client from before the last `prisma generate`.
 * A new model (expense) or a new column (Person.searchName) means drop it.
 */
function isCurrentGeneratedClient(client: PrismaClient): boolean {
  const hasExpense =
    typeof (client as { expense?: { findMany?: unknown } }).expense?.findMany ===
    "function";
  if (!hasExpense) return false;

  const person = (
    client as {
      _runtimeDataModel?: {
        models?: { Person?: { fields?: RuntimeField[] } };
      };
    }
  )._runtimeDataModel?.models?.Person;
  if (person?.fields?.some((field) => field.name === "searchName") !== true) {
    return false;
  }

  return (
    typeof (client as { bookingDueChange?: { create?: unknown } }).bookingDueChange
      ?.create === "function"
  );
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
