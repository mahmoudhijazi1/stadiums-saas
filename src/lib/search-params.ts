/** A Next.js searchParams value as a single string, or undefined (array or missing). */
export function queryString(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
