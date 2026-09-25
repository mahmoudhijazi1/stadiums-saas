/**
 * Public stadium home used inside WhatsApp messages.
 * APP_PROTOCOL defaults to https. APP_BASE_DOMAIN is the parent host
 * (lebstads.com, or localhost:3000 in local dev).
 */
export function publicPageUrl(slug: string): string {
  const domain = process.env.APP_BASE_DOMAIN?.trim() ?? "";
  const tenant = slug.trim();
  if (!domain || !tenant) return "";
  const protocol = process.env.APP_PROTOCOL?.trim() || "https";
  return `${protocol}://${tenant}.${domain}/`;
}
