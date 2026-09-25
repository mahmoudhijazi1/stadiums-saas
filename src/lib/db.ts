import { prismaBase } from "@/lib/prisma-base";
import {
  getCurrentTenantId,
  withCurrentTenant,
} from "@/lib/tenant-context";

/** Models that must always be filtered/stamped with tenantId (DR-001). */
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
  "BookingDueChange",
]);

/**
 * Tenant-scoped Prisma client — primary isolation guard (RLS comes later).
 *
 * For tenant-owned models (Pitch, Person, Booking, …, Payment, LedgerEntry, Expense):
 * - reads (findMany, etc.) get `where.tenantId` injected automatically
 * - creates get `data.tenantId` stamped automatically
 *
 * Callers must NOT pass tenantId themselves — that proves the guard works.
 *
 * Prisma 7 docs: Client Extensions → query component (`$allModels` + `$allOperations`).
 * https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/query
 *
 * `$transaction` is wrapped: tenant is loaded *before* BEGIN and stored on the
 * request (ALS). The extension then reads memory, not platformDb — a nested
 * query on the same PrismaClient during an interactive transaction deadlocks
 * or kills the socket (Prisma 7 + adapter-pg).
 */
const scoped = prismaBase.$extends({
  name: "tenantScope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Booking has no typed create (required Unsupported `during`), so Prisma 7
        // types $allOperations as the intersection — `create` is missing from the union.
        // Person / BookingParticipant still create at runtime; compare as string.
        const op = operation as string;
        const run = query as (queryArgs: typeof args) => ReturnType<typeof query>;

        if (!TENANT_SCOPED_MODELS.has(model)) {
          return run(args);
        }

        const tenantId = await getCurrentTenantId();

        if (op === "create") {
          const createArgs = args as { data: Record<string, unknown> };
          createArgs.data = { ...createArgs.data, tenantId };
          return run(args);
        }

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

        // findMany-style ops get tenantId in where (above). findUnique / update /
        // delete cannot always put tenantId in a unique where — handle carefully:
        //
        // - findUnique: ensure tenantId is on the result for the post-check (inject
        //   into select if the caller omitted it), then null out cross-tenant rows.
        // - update / delete: PRE-check with findFirst({ ...where, tenantId }). A
        //   post-check is too late — the write already committed on top-level db.

        if (op === "update" || op === "delete") {
          const { where } = args as { where: Record<string, unknown> };
          const modelKey =
            model.charAt(0).toLowerCase() + model.slice(1);
          const owned = await (
            prismaBase as unknown as Record<
              string,
              {
                findFirst: (args: {
                  where: Record<string, unknown>;
                  select: { id: true };
                }) => Promise<{ id: string } | null>;
              }
            >
          )[modelKey].findFirst({
            where: { ...where, tenantId },
            select: { id: true },
          });
          if (!owned) {
            throw new Error(`Tenant scope violation on ${model}.${operation}`);
          }
          return run(args);
        }

        const selectArgs = args as {
          select?: Record<string, unknown> | null;
        };
        const callerSelect = selectArgs.select;
        const injectedTenantIdSelect =
          callerSelect != null &&
          typeof callerSelect === "object" &&
          !("tenantId" in callerSelect);
        if (injectedTenantIdSelect) {
          selectArgs.select = { ...callerSelect, tenantId: true };
        }

        const result = await run(args);
        if (result && typeof result === "object" && "tenantId" in result) {
          if ((result as { tenantId: string }).tenantId !== tenantId) {
            if (op === "findUnique") return null;
            throw new Error(`Tenant scope violation on ${model}.${operation}`);
          }
          if (injectedTenantIdSelect) {
            const { tenantId: _stripped, ...rest } = result as Record<
              string,
              unknown
            > & { tenantId: string };
            return rest;
          }
        }
        return result;
      },
    },
  },
});

const beginTransaction = scoped.$transaction.bind(scoped);

scoped.$transaction = ((
  ...args: Parameters<typeof scoped.$transaction>
) =>
  withCurrentTenant(
    () => beginTransaction(...args) as ReturnType<typeof scoped.$transaction>,
  )) as typeof scoped.$transaction;

const db = scoped;

/** `tx` from `db.$transaction` — still tenant-scoped. Repositories take this, never import `db`. */
export type TenantTx = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$transaction" | "$extends"
>;

export default db;
