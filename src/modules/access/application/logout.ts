import {
  clearSessionCookie,
  readSessionCookie,
} from "@/modules/access/infrastructure/session-cookie";
import { deleteSessionByToken } from "@/modules/access/infrastructure/sessions";

/**
 * Drop the server session and the cookie. Call from a Server Action (cookie `.delete`).
 */
export async function logout(): Promise<void> {
  const token = await readSessionCookie();
  if (token) {
    await deleteSessionByToken(token);
  }
  await clearSessionCookie();
}
