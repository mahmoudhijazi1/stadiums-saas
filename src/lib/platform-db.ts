import { prismaBase } from "@/lib/prisma-base";

/**
 * Unscoped database client (no tenant filter).
 * Use for: looking up Tenant by slug, seeding, platform admin.
 * Name is intentionally special so we don't use it by accident.
 *
 * Same PrismaClient as `db`'s base — never query this *during*
 * `db.$transaction`. Tenant id is loaded first and stored on the request
 * (`withCurrentTenant` in tenant-context).
 */
export const platformDb = prismaBase;
