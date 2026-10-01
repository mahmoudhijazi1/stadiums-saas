import { notFound } from "next/navigation";

/** Dev-only routes 404 in production. Its own file so a test can run it with NODE_ENV=production. */
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
