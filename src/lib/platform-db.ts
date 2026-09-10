import { prismaBase } from "@/lib/prisma-base";

/**
 * Unscoped database client (no tenant filter).
 * Use for: Tenant by slug, User/Session (no tenantId — DR-003), seeding, platform admin.
 * Name is intentionally special so we don't use it by accident.
 *
 * Same PrismaClient as `db`'s base — never query this *during*
 * `db.$transaction`. Tenant id is loaded first and stored on the request
 * (`withCurrentTenant` in tenant-context). Membership still goes through `db`.
 */
export const platformDb = prismaBase;
