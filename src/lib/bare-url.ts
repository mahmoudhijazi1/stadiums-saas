/** An absolute URL on the bare domain: APP_PROTOCOL://APP_BASE_DOMAIN + path (protocol defaults to https). */
export function bareUrl(path: string): string {
  const protocol = process.env.APP_PROTOCOL?.trim() || "https";
  const base = (process.env.APP_BASE_DOMAIN ?? "").trim().toLowerCase();
  return `${protocol}://${base}${path}`;
}
