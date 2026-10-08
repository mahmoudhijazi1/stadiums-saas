"use server";

import { revalidatePath } from "next/cache";
import { actionErrorKey } from "@/lib/use-case-error";
import { archiveProduct, createProduct, updateProduct } from "@/modules/shop/application/products";

/** Thin catalog actions: validate and authorize in the use case, no redirect (the sheet stays). */
export type ShopResult = { ok: true } | { error: string };

async function run(useCase: string, work: () => Promise<void>): Promise<ShopResult> {
  try {
    await work();
  } catch (error) {
    return { error: await actionErrorKey(error, useCase) };
  }
  revalidatePath("/owner/more/shop");
  return { ok: true };
}

export async function submitCreateProduct(input: unknown): Promise<ShopResult> {
  return run("submitCreateProduct", async () => {
    await createProduct(input);
  });
}

export async function submitUpdateProduct(id: unknown, input: unknown): Promise<ShopResult> {
  return run("submitUpdateProduct", () => updateProduct(id, input));
}

export async function submitArchiveProduct(id: unknown): Promise<ShopResult> {
  return run("submitArchiveProduct", () => archiveProduct(id));
}
