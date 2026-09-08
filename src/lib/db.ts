import { prismaBase } from "@/lib/prisma-base";
import { getCurrentTenantId } from "@/lib/tenant-context";

/** Models that must always be filtered/stamped with tenantId (DR-001). */
const TENANT_SCOPED_MODELS = new Set(["Pitch"]);

/**
 * Tenant-scoped Prisma client — primary isolation guard (RLS comes later).
 *
 * For Pitch queries:
 * - reads (findMany, etc.) get `where.tenantId` injected automatically
 * - creates get `data.tenantId` stamped automatically
 *
 * Callers must NOT pass tenantId themselves — that proves the guard works.
 *
 * Prisma docs: Client Extensions → query component
 * https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
 */
const db = prismaBase.$extends({
  name: "tenantScope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const tenantId = await getCurrentTenantId();

        if (operation === "create") {
          const createArgs = args as { data: Record<string, unknown> };
          createArgs.data = { ...createArgs.data, tenantId };
          return query(args);
        }

        if (operation === "createMany" || operation === "createManyAndReturn") {
          const createArgs = args as {
            data: Record<string, unknown> | Record<string, unknown>[];
          };
          if (Array.isArray(createArgs.data)) {
            createArgs.data = createArgs.data.map((row) => ({ ...row, tenantId }));
          } else {
            createArgs.data = { ...createArgs.data, tenantId };
          }
          return query(args);
        }

        if (
          operation === "findMany" ||
          operation === "findFirst" ||
          operation === "findFirstOrThrow" ||
          operation === "count" ||
          operation === "aggregate" ||
          operation === "groupBy" ||
          operation === "updateMany" ||
          operation === "deleteMany"
        ) {
          const filtered = args as { where?: Record<string, unknown> };
          filtered.where = { ...filtered.where, tenantId };
          return query(args);
        }

        // findUnique / update / delete: unique where can't always include tenantId —
        // run the query, then reject rows that belong to another tenant.
        const result = await query(args);
        if (result && typeof result === "object" && "tenantId" in result) {
          if ((result as { tenantId: string }).tenantId !== tenantId) {
            if (operation === "findUnique") return null;
            throw new Error(`Tenant scope violation on ${model}.${operation}`);
          }
        }
        return result;
      },
    },
  },
});

export default db;
