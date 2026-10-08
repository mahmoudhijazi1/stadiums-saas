import { DomainError } from "@/lib/errors";
import db from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";
import { rethrowUnexpected } from "@/lib/use-case-error";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { SHOP_MANAGE, SHOP_SELL, can } from "@/modules/access/domain/can";
import { orderByPopularity } from "@/modules/shop/domain/sale";
import {
  archiveProductRow,
  insertProduct,
  listProductsWithSold,
  updateProductRow,
  type ProductWithSold,
} from "@/modules/shop/infrastructure/products";
import { parseProductInput, productIdSchema } from "@/modules/shop/schemas/product";

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireManager() {
  const membership = await getCurrentMembership();
  if (!membership || !can(membership, SHOP_MANAGE)) throw new DomainError("access.not_allowed");
  return membership;
}

/** Add an item to the catalog. shop.manage (owner only). */
export async function createProduct(input: unknown): Promise<{ id: string }> {
  await requireManager();
  // Parsed outside the try: bad input is a ZodError for the action to map (form.invalid), not a bug.
  const parsed = parseProductInput(input);
  try {
    const row = await insertProduct(db, { name: parsed.name, priceUsd: parsed.priceUsd });
    logger.info(`Product created ${row.id}`, undefined, { useCase: "createProduct", tenantId: await safeTenantId() });
    return { id: row.id };
  } catch (error) {
    return await rethrowUnexpected(error, "Create product failed", "createProduct");
  }
}

/** Rename or re-price an item. Future sales only: past lines keep their frozen price. */
export async function updateProduct(id: unknown, input: unknown): Promise<void> {
  await requireManager();
  const productId = productIdSchema.parse(id);
  const parsed = parseProductInput(input);
  try {
    if (!(await updateProductRow(db, productId, { name: parsed.name, priceUsd: parsed.priceUsd }))) {
      throw new DomainError("shop.product_not_found");
    }
  } catch (error) {
    await rethrowUnexpected(error, "Update product failed", "updateProduct");
  }
}

/** Archive (never delete): hidden from selling, kept on past sales. */
export async function archiveProduct(id: unknown): Promise<void> {
  await requireManager();
  const productId = productIdSchema.parse(id);
  try {
    if (!(await archiveProductRow(db, productId, new Date()))) {
      throw new DomainError("shop.product_not_found");
    }
  } catch (error) {
    await rethrowUnexpected(error, "Archive product failed", "archiveProduct");
  }
}

/**
 * The catalog, most sold in the last 30 days first, then by name. `forSale` is the selling
 * grid (shop.sell, or shop.manage): active items only. Otherwise the manage list
 * (shop.manage): active items only too (archived are hidden everywhere in this slice).
 */
export async function listProducts(input: { forSale: boolean }, now: Date = new Date()): Promise<ProductWithSold[]> {
  const membership = await getCurrentMembership();
  const allowed = membership && (can(membership, SHOP_MANAGE) || (input.forSale && can(membership, SHOP_SELL)));
  if (!allowed) throw new DomainError("access.not_allowed");

  try {
    const items = await listProductsWithSold(db, {
      since: new Date(now.getTime() - 30 * DAY_MS),
      includeArchived: false,
    });
    return orderByPopularity(items);
  } catch (error) {
    return await rethrowUnexpected(error, "List products failed", "listProducts");
  }
}

export type { ProductWithSold };
