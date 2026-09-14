import { prismaBase } from "@/lib/prisma-base";
import {
  getCurrentTenantId,
  withCurrentTenant,
} from "@/lib/tenant-context";

// ---------------------------------------------------------------------------
// WHAT THIS FILE IS
// ---------------------------------------------------------------------------
// This is the ONE place that guarantees "Ahmad's stadium never sees Sami's
// data." Every query on a tenant-owned table gets automatically filtered
// (on reads) or stamped (on writes) with the current tenantId — so the
// repository code elsewhere in the app never has to remember to do it by
// hand, and can't accidentally forget.
//
// It ALSO fixes a real bug we hit: if this guard tries to look up "which
// tenant is this?" by querying the database WHILE a transaction is already
// open and holding a connection, the app deadlocks (see the $transaction
// wrapping at the bottom — that's the actual fix).
// ---------------------------------------------------------------------------

/**
 * Every table listed here BELONGS to a tenant (a stadium). If a model is in
 * this list, the code below will refuse to let a query run without a
 * tenantId attached to it.
 *
 * Tables NOT in this list (like Tenant itself, or User) are intentionally
 * global — they aren't "owned" by any one stadium.
 */
const TENANT_SCOPED_MODELS = new Set([
  "Pitch",
  "Person",
  "Booking",
  "BookingParticipant",
  "Membership",
  "UserPersonLink",
  "SlotInterest",
  "ExchangeRate",
  "Payment",
  "PaymentTender",
  "LedgerEntry",
  "Expense",
]);

/**
 * `$extends` is Prisma's official, documented way to intercept EVERY query
 * before it actually runs. Think of it as a checkpoint that every single
 * database call has to pass through first.
 *
 * We use that checkpoint to inject/verify tenantId automatically, so no
 * developer (including future-you) has to remember to type `.where({
 * tenantId })` on every single query by hand — which is exactly the kind
 * of thing that's easy to forget once, and only shows up as a real bug
 * (data leaking between stadiums) much later.
 *
 * Docs: https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/query
 */
const scoped = prismaBase.$extends({
  name: "tenantScope",
  query: {
    // "$allModels" + "$allOperations" together mean: run this function
    // before ANY query, on ANY table, no matter what kind of query it is
    // (find, create, update, delete, etc).
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // --- Type workaround, not a design choice -------------------------
        // Normally Prisma gives you a nicely typed `operation` string like
        // "create" | "findMany" | etc. But our Booking table has a column
        // (`during`, a Postgres date-range type) that Prisma can't fully
        // type — it marks it "Unsupported". That one quirk makes Prisma's
        // types for this callback incomplete (it "forgets" that `create`
        // is a possible operation). We cast to plain `string` here just so
        // TypeScript doesn't fight us — this has nothing to do with the
        // tenant logic itself.
        const op = operation as string;
        const run = query as (queryArgs: typeof args) => ReturnType<typeof query>;

        // If this table isn't tenant-owned (e.g. Tenant, User), skip all
        // the logic below and just let the query run untouched.
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return run(args);
        }

        // THE ONE LINE THAT CAN CAUSE A DEADLOCK IF MISUSED:
        // This asks "which tenant/stadium is the current request for?"
        // If we're NOT inside a transaction, this is a normal, harmless
        // database query (or a cached answer). If we ARE inside a
        // transaction, this MUST be answered from memory (see the
        // $transaction wrapping below) — if it tried to hit the database
        // again here while a transaction already holds the only available
        // connection, both would wait on each other forever (a deadlock).
        const tenantId = await getCurrentTenantId();

        // --- WRITES: stamp tenantId onto anything being created -----------
        // This means when application code does something like
        // `db.pitch.create({ data: { name: "A1" } })`, this code quietly
        // rewrites it behind the scenes to
        // `db.pitch.create({ data: { name: "A1", tenantId } })`
        // — the calling code never has to know or remember to do this.
        if (op === "create") {
          const createArgs = args as { data: Record<string, unknown> };
          createArgs.data = { ...createArgs.data, tenantId };
          return run(args);
        }

        // Same idea, but for bulk-creates (an array of rows instead of one).
        if (op === "createMany" || op === "createManyAndReturn") {
          const createArgs = args as {
            data: Record<string, unknown> | Record<string, unknown>[];
          };
          if (Array.isArray(createArgs.data)) {
            createArgs.data = createArgs.data.map((row) => ({ ...row, tenantId }));
          } else {
            createArgs.data = { ...createArgs.data, tenantId };
          }
          return run(args);
        }

        // --- READS / BULK OPERATIONS: filter by tenantId -------------------
        // For anything that takes a `where` clause and can return/affect
        // MULTIPLE rows, we can safely just add `tenantId` into the filter
        // — e.g. `findMany({ where: { status: "PENDING" } })` becomes
        // `findMany({ where: { status: "PENDING", tenantId } })`.
        // This is the main way "Sami never sees Ahmad's bookings" actually
        // happens — every list/search query is silently narrowed.
        if (
          op === "findMany" ||
          op === "findFirst" ||
          op === "findFirstOrThrow" ||
          op === "count" ||
          op === "aggregate" ||
          op === "groupBy" ||
          op === "updateMany" ||
          op === "deleteMany"
        ) {
          const filtered = args as { where?: Record<string, unknown> };
          filtered.where = { ...filtered.where, tenantId };
          return run(args);
        }

        // --- SINGLE-ROW LOOKUPS BY ID: check AFTER, not before -------------
        // findUnique / update / delete usually look a row up by its unique
        // ID (like `{ where: { id: "abc123" } }`). We CAN'T just tack
        // `tenantId` onto that `where` clause the way we did above, because
        // Prisma requires the `where` on these operations to exactly match
        // a real unique key shape — adding an extra field can break the
        // query or isn't guaranteed to be allowed depending on the schema.
        //
        // So instead: let the query run normally (it finds the row purely
        // by ID), and only AFTER we get the result, check whether that
        // row's tenantId actually matches the current tenant.
        //
        // - If it's a plain lookup (findUnique) and it belongs to someone
        //   else: pretend it doesn't exist (return null) — exactly like a
        //   real 404, not an error message that reveals the row IS there.
        // - If it's an update/delete on someone else's row: that should
        //   never legitimately happen, so we throw loudly — this would
        //   only happen if there's a real bug elsewhere.
        const result = await run(args);
        if (result && typeof result === "object" && "tenantId" in result) {
          if ((result as { tenantId: string }).tenantId !== tenantId) {
            if (op === "findUnique") return null;
            throw new Error(`Tenant scope violation on ${model}.${operation}`);
          }
        }
        return result;
      },
    },
  },
});

// ---------------------------------------------------------------------------
// THE ACTUAL DEADLOCK FIX
// ---------------------------------------------------------------------------
// This is the part that took several failed attempts to get right (see
// docs/guides/prisma-transaction-tenant-guard.md for the full story).
//
// THE PROBLEM: an interactive `$transaction` holds one database connection
// open until it finishes (BEGIN ... COMMIT). While that connection is held,
// Prisma will NOT let you run a second query on the same client. But the
// tenant guard above (`getCurrentTenantId()`) needs to query the database
// too — and if that happens WHILE we're already inside a transaction, the
// transaction and the tenant lookup wait on each other forever, and Prisma
// eventually times out with an "expired transaction" error.
//
// THE FIX: never let the tenant lookup happen a second time once a
// transaction has started. Instead, look up the tenant ONCE, before the
// transaction even begins, and store the answer in memory using Node's
// AsyncLocalStorage (that's what `withCurrentTenant` does). Then, for the
// entire duration of the transaction, `getCurrentTenantId()` just reads
// that stored value from memory — it never touches the database again.
// ---------------------------------------------------------------------------

// Keep a reference to Prisma's real, original `$transaction` method before
// we override it below — we still need to actually call it, just wrapped.
const beginTransaction = scoped.$transaction.bind(scoped);

// Every time ANY code in the app calls `db.$transaction(...)`, this
// replacement runs FIRST. `withCurrentTenant(...)` is what loads the
// tenant and stashes it in AsyncLocalStorage — and only once that's done
// does it actually call the real `beginTransaction(...)` to open the
// database transaction. By the time `BEGIN` runs, the tenant is already
// sitting in memory, so nothing inside the transaction ever needs to ask
// the database "which tenant is this?" again.
scoped.$transaction = ((
  ...args: Parameters<typeof scoped.$transaction>
) =>
  withCurrentTenant(
    () => beginTransaction(...args) as ReturnType<typeof scoped.$transaction>,
  )) as typeof scoped.$transaction;

const db = scoped;

/**
 * This describes the shape of `tx` — the special client you get INSIDE a
 * `db.$transaction(async (tx) => { ... })` callback. It's the same tenant-
 * scoped client, minus a few methods that would be dangerous or meaningless
 * to call from inside an already-open transaction:
 *
 * - `$transaction` itself (you can't open a transaction inside a
 *   transaction)
 * - `$connect` / `$disconnect` (connection lifecycle isn't something a
 *   single transaction should be touching)
 * - `$extends` (you shouldn't be re-wrapping the client mid-transaction)
 *
 * Repository functions are written to accept this `TenantTx` type instead
 * of importing `db` directly — that's what makes "the use case that starts
 * the transaction owns it" actually enforceable by the type system, not
 * just a rule everyone has to remember.
 */
export type TenantTx = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$transaction" | "$extends"
>;

export default db;