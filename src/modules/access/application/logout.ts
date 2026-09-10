import {
  clearSessionCookie,
  readSessionCookie,
} from "@/modules/access/infrastructure/session-cookie";
import { deleteSession } from "@/modules/access/infrastructure/sessions";

/**
 * Drop the server session and the cookie. Call from a Server Action (cookie `.delete`).
 */
export async function logout(): Promise<void> {
  const id = await readSessionCookie();
  if (id) {
    await deleteSession(id);
  }
  await clearSessionCookie();
}
