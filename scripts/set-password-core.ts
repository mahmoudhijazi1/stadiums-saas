import { platformDb } from "@/lib/platform-db";
import { hashPassword } from "@/modules/access/infrastructure/password";
import { askNewPassword, confirmDatabase, type OperatorIo } from "./lib/operator-io";

/**
 * Operator password reset (docs/RUNBOOK.md, "Passwords"). Crosses tenants, so
 * it uses platformDb. The terminal is injected so tests can script answers.
 */
export { MIN_PASSWORD_LENGTH } from "@/modules/access/domain/password-policy";
export type SetPasswordIo = OperatorIo;

export async function setPassword(
  identifier: string,
  databaseUrl: string | undefined,
  io: SetPasswordIo,
): Promise<void> {
  await confirmDatabase(io, databaseUrl);

  const user = await platformDb.user.findUnique({
    where: { identifier },
    select: { id: true, identifier: true },
  });
  if (!user) throw new Error(`Refused: no user ${identifier}.`);

  const password = await askNewPassword(io, { identifier: user.identifier });
  const passwordHash = await hashPassword(password);
  await platformDb.$transaction([
    platformDb.user.update({ where: { id: user.id }, data: { passwordHash } }),
    platformDb.session.deleteMany({ where: { userId: user.id } }),
  ]);
  io.print(`updated ${user.identifier}`);
}

/** One line per membership: identifier, role, tenant slug. Never the hash. */
export async function listAccounts(print: (line: string) => void): Promise<void> {
  const users = await platformDb.user.findMany({
    orderBy: { identifier: "asc" },
    select: {
      identifier: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { role: true, tenant: { select: { slug: true } } },
      },
    },
  });
  for (const user of users) {
    if (user.memberships.length === 0) {
      print(`${user.identifier}\t-\t-`);
      continue;
    }
    for (const membership of user.memberships) {
      print(`${user.identifier}\t${membership.role}\t${membership.tenant.slug}`);
    }
  }
}
