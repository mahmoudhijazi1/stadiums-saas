/**
 * The browser wants the VAPID public key as bytes (pushManager.subscribe applicationServerKey);
 * we hold it as base64url text. Pure, so it is safe to import from a Client Component.
 */
export function vapidKeyToBytes(base64Url: string): Uint8Array {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
