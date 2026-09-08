import { prismaBase } from "@/lib/prisma-base";

/**
 * Unscoped database client (no tenant filter).
 * Use for: looking up Tenant by slug, seeding, platform admin.
 * Name is intentionally special so we don't use it by accident.
 */
export const platformDb = prismaBase;
