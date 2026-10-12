import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isBareHostFromHeaders } from "@/lib/tenant-slug";

/**
 * The landing routes answer only on exactly the bare host, whatever the proxy did (it already 404s
 * /landing everywhere and rewrites only the bare host). Resolves no tenant and touches no database.
 */
export async function requireBareHost(): Promise<void> {
  if (!isBareHostFromHeaders(await headers())) notFound();
}
