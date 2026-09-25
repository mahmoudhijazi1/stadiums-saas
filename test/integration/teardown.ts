import db from "@/lib/db";
import { endPrismaPool, prismaBase } from "@/lib/prisma-base";

/**
 * Call at the end of each integration file's afterAll, after truncate.
 * Jest loads a fresh module graph per file, so each file has its own client
 * and pg pool. Disconnect both clients and end that pool or the worker stays up.
 */
export async function finishIntegrationFile(): Promise<void> {
  await db.$disconnect();
  await prismaBase.$disconnect();
  await endPrismaPool();
}
