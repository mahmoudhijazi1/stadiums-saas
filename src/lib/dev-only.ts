import { notFound } from "next/navigation";

/**
 * Dev-only routes 404 in production. One guard for every page under src/app/dev: each page and
 * the dev layout call it. Its own file so a test can run it with NODE_ENV=production.
 */
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
