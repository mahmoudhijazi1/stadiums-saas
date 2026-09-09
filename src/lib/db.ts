import { prismaBase } from "@/lib/prisma-base";
import { getCurrentTenantId } from "@/lib/tenant-context";

/** Models that must always be filtered/stamped with tenantId (DR-001). */
const TENANT_SCOPED_MODELS = new Set([
  "Pitch",
  "Person",
  "Booking",
  "BookingParticipant",
]);

/**
 * Tenant-scoped Prisma client — primary isolation guard (RLS comes later).
 *
 * For Pitch / Person / Booking / BookingParticipant:
 * - reads (findMany, etc.) get `where.tenantId` injected automatically
 * - creates get `data.tenantId` stamped automatically
 *
 * Callers must NOT pass tenantId themselves — that proves the guard works.
 *
 * Prisma 7 docs: Client Extensions → query component (`$allModels` + `$allOperations`).
 * https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions/query
 */
const db = prismaBase.$extends({
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

        // findUnique / update / delete: unique where can't always include tenantId —
        // run the query, then reject rows that belong to another tenant.
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

/** `tx` from `db.$transaction` — still tenant-scoped. Repositories take this, never import `db`. */
export type TenantTx = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$transaction" | "$extends"
>;

export default db;
