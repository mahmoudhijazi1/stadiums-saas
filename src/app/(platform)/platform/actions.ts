"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trustedClientIp } from "@/lib/client-ip";
import { DomainError } from "@/lib/errors";
import { requirePlatformHost } from "@/lib/require-platform-host";
import { actionErrorKey } from "@/lib/use-case-error";
import {
  createStadiumAsAdmin,
  resumeStadiumAsAdmin,
  suspendStadiumAsAdmin,
} from "@/modules/platform/application/admin-tenant-actions";
import { platformLogin } from "@/modules/platform/application/platform-login";
import {
  getCurrentPlatformAdmin,
  platformLogout,
  requirePlatformAdmin,
  setPlatformSessionCookie,
} from "@/modules/platform/application/platform-session";
import { parsePlatformLogin } from "@/modules/platform/schemas/login";
import {
  paidUntilDate,
  parseCreateStadium,
  parseResumeStadium,
  parseSuspendStadium,
} from "@/modules/platform/schemas/stadium-actions";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Thin Server Actions (DR-006). Each one runs the host guard first, whatever the proxy did.
 * Login: validate, delegate, write the cookie, redirect (redirect() outside try/catch, redirect.md).
 * Any failure but a block shows the same generic message.
 */
export async function submitPlatformLogin(formData: FormData) {
  await requirePlatformHost();
  let failure: string | undefined;
  try {
    const parsed = parsePlatformLogin({
      identifier: field(formData, "identifier"),
      password: field(formData, "password"),
      code: field(formData, "code"),
    });
    const { token } = await platformLogin({ ...parsed, ip: await trustedClientIp() });
    await setPlatformSessionCookie(token);
  } catch (error) {
    const key = await actionErrorKey(error, "submitPlatformLogin");
    failure = key === "platform.login_blocked" ? key : "platform.login_failed";
  }
  if (failure) redirect(`/platform/login?error=${failure}`);
  redirect("/platform");
}

/** Logout needs a session: without one nothing is deleted and the visitor goes to the login. */
export async function submitPlatformLogout() {
  await requirePlatformHost();
  if (!(await getCurrentPlatformAdmin())) redirect("/platform/login");
  await platformLogout();
  redirect("/platform/login");
}

export type StadiumActionResult = { ok: true } | { ok: false; errorKey: string };
export type CreateStadiumResult =
  | { ok: true; slug: string; ownerIdentifier: string; ownerPassword: string }
  | { ok: false; errorKey: string };

/**
 * Create a stadium with its owner (DR-006 slice 6). Host guard, then a session, then the use case
 * with actor `admin:<id>`. The owner's first password comes back ONCE in the result, for the page to
 * show; it is never put in a URL, a log or the audit detail.
 */
export async function submitCreateStadium(input: unknown): Promise<CreateStadiumResult> {
  await requirePlatformHost();
  try {
    const admin = await requirePlatformAdmin();
    const parsed = parseCreateStadium(input);
    const paidUntil = paidUntilDate(parsed.paidUntil);
    if (paidUntil === "invalid") throw new DomainError("platform.paid_until_invalid");
    const created = await createStadiumAsAdmin({
      name: parsed.name,
      slug: parsed.slug.trim().toLowerCase(),
      dayStartHour: parsed.dayStartHour === 6 ? null : parsed.dayStartHour,
      plan: parsed.plan?.trim() || null,
      paidUntil,
      actor: `admin:${admin.adminId}`,
    });
    revalidatePath("/platform");
    return { ok: true, ...created };
  } catch (error) {
    return { ok: false, errorKey: await actionErrorKey(error, "submitCreateStadium") };
  }
}

/** Suspend: a reason and the slug typed back, checked here again. */
export async function submitSuspendStadium(input: unknown): Promise<StadiumActionResult> {
  await requirePlatformHost();
  try {
    const admin = await requirePlatformAdmin();
    const parsed = parseSuspendStadium(input);
    await suspendStadiumAsAdmin({ ...parsed, actor: `admin:${admin.adminId}` });
    revalidatePath("/platform");
    revalidatePath(`/platform/stadiums/${parsed.slug}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, errorKey: await actionErrorKey(error, "submitSuspendStadium") };
  }
}

/** Resume: the slug typed back, checked here again. */
export async function submitResumeStadium(input: unknown): Promise<StadiumActionResult> {
  await requirePlatformHost();
  try {
    const admin = await requirePlatformAdmin();
    const parsed = parseResumeStadium(input);
    await resumeStadiumAsAdmin({ ...parsed, actor: `admin:${admin.adminId}` });
    revalidatePath("/platform");
    revalidatePath(`/platform/stadiums/${parsed.slug}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, errorKey: await actionErrorKey(error, "submitResumeStadium") };
  }
}
