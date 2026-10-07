"use server";

import { z } from "zod";
import { actionErrorKey } from "@/lib/use-case-error";
import { changeOwnPassword } from "@/modules/access/application/change-own-password";
import { changeOwnIdentifier } from "@/modules/access/application/change-own-identifier";
import { logOutOtherDevices } from "@/modules/access/application/log-out-other-devices";

/**
 * Own-credential actions. The acting user comes from the session inside each use case:
 * nothing here takes a user id or an identifier suffix from the client. They do not
 * redirect (the sheet stays open and shows the result) and never log or echo a password.
 */
export type AccountResult = { ok: true } | { error: string };
export type IdentifierResult = { ok: true; identifier: string } | { error: string };
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

// `localPart` may carry a typed "@suffix": the use case drops it and uses the tenant's slug.
const identifierSchema = z.strictObject({
  localPart: z.string().max(120),
  currentPassword: z.string().min(1).max(200),
});

export async function submitChangeIdentifier(input: unknown): Promise<IdentifierResult> {
  try {
    const { identifier } = await changeOwnIdentifier(identifierSchema.parse(input));
    return { ok: true, identifier };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitChangeIdentifier") };
  }
}
