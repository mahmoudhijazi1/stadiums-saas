import { platformDb } from "@/lib/platform-db";
import { hashPassword } from "@/modules/access/infrastructure/password";
import { databaseNameFromUrl } from "@/prisma/seed-guard";

/**
 * Operator password reset (docs/RUNBOOK.md, "Passwords"). Crosses tenants, so
 * it uses platformDb. The terminal is injected so tests can script answers.
 */
export const MIN_PASSWORD_LENGTH = 12;

export type SetPasswordIo = {
  /** One answer. Hidden answers are never echoed. */
  ask(question: string, options: { hidden: boolean }): Promise<string>;
  /** Prompts and notes (stderr). */
  say(line: string): void;
  /** The result line (stdout). */
  print(line: string): void;
};

export async function setPassword(
  identifier: string,
  databaseUrl: string | undefined,
  io: SetPasswordIo,
): Promise<void> {
  const database = databaseNameFromUrl(databaseUrl);
  if (!database) throw new Error("DATABASE_URL is missing or has no database name.");

  io.say(`Database: ${database}`);
  const typed = await io.ask("Type the database name to continue: ", { hidden: false });
  if (typed.trim() !== database) throw new Error("Refused: the database name does not match.");

  const user = await platformDb.user.findUnique({
    where: { identifier },
    select: { id: true, identifier: true },
  });
  if (!user) throw new Error(`Refused: no user ${identifier}.`);

  const password = await io.ask("New password: ", { hidden: true });
  const again = await io.ask("Repeat new password: ", { hidden: true });
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Refused: the password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password !== again) throw new Error("Refused: the two passwords do not match.");

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
