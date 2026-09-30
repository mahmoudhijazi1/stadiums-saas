/**
 * Runs once when a Next.js server starts, before it serves requests
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 * Not run by `next build`. Node-only work is imported under NEXT_RUNTIME,
 * as the docs show.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enforceEnvAtStartup } = await import("@/lib/env");
    enforceEnvAtStartup();
  }
}
