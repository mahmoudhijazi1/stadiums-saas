"use server";

import { z } from "zod";
import { actionErrorKey } from "@/lib/use-case-error";
import { changeOwnPassword } from "@/modules/access/application/change-own-password";
import { logOutOtherDevices } from "@/modules/access/application/log-out-other-devices";

/**
 * Own-credential actions. The acting user comes from the session inside each use case:
 * nothing here takes a user id or an identifier suffix from the client. They do not
 * redirect (the sheet stays open and shows the result) and never log or echo a password.
 */
export type AccountResult = { ok: true } | { error: string };
export type LogoutOthersResult = { ok: true; closed: number } | { error: string };

const passwordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

export async function submitChangePassword(input: unknown): Promise<AccountResult> {
  try {
    await changeOwnPassword(passwordSchema.parse(input));
  } catch (error) {
    return { error: await actionErrorKey(error, "submitChangePassword") };
  }
  return { ok: true };
}

export async function submitLogOutOtherDevices(): Promise<LogoutOthersResult> {
  try {
    const { closed } = await logOutOtherDevices();
    return { ok: true, closed };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitLogOutOtherDevices") };
  }
}
