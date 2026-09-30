import { parseArgs } from "node:util";
import { DomainError } from "@/lib/errors";
import { createTenant, validateCreateTenantInput } from "@/modules/platform/application/create-tenant";
import { listTenants } from "@/modules/platform/application/list-tenants";
import { resumeTenant } from "@/modules/platform/application/resume-tenant";
import { setSubscription } from "@/modules/platform/application/set-subscription";
import { suspendTenant } from "@/modules/platform/application/suspend-tenant";
import {
  askNewPassword,
  confirmDatabase,
  confirmTyped,
  requireInteractive,
  type OperatorIo,
} from "./lib/operator-io";

/**
 * The platform operator CLI (docs/RUNBOOK.md, "Tenant management"). Argument
 * parsing, confirmations and output live here; the use cases in
 * src/modules/platform take an explicit actor and never touch the terminal.
 * Password resets stay in scripts/set-password.ts.
 */
export const USAGE = [
  "Usage: tsx scripts/platform.ts <command>",
  "  tenants list",
  "  tenants create --slug <slug> --name <name> [--plan <label>] [--paid-until YYYY-MM-DD] [--owner-identifier <local@slug>]",
  "  tenants suspend <slug> --reason <text>",
  "  tenants resume <slug>",
  "  subscriptions set <slug> --plan <label> --paid-until YYYY-MM-DD [--amount <usd>] [--note <text>]",
].join("\n");

export type CliContext = {
  io: OperatorIo;
  /** stdin is a TTY. Every mutating command refuses without one. */
  interactive: boolean;
  databaseUrl: string | undefined;
  /** "cli:<os user>@<hostname>", computed by scripts/platform.ts. */
  actor: string;
  now?: Date;
};

const OPTIONS = {
  slug: { type: "string" },
  name: { type: "string" },
  plan: { type: "string" },
  "paid-until": { type: "string" },
  "owner-identifier": { type: "string" },
  reason: { type: "string" },
  amount: { type: "string" },
  note: { type: "string" },
} as const;

/** Operator-facing text for the platform domain keys. */
const MESSAGES: Record<string, string> = {
  "platform.slug_invalid":
    "Refused: the slug must be 3-30 characters of a-z, 0-9 and single inner hyphens, not reserved, not xn--.",
  "platform.slug_taken": "Refused: that slug is already used.",
  "platform.identifier_invalid": "Refused: the owner identifier must be <local>@<slug> with this tenant's slug.",
  "platform.identifier_taken": "Refused: that owner identifier is already used.",
  "platform.password_too_short": "Refused: the password must be at least 12 characters.",
  "platform.name_required": "Refused: --name is required.",
  "platform.name_too_long": "Refused: --name is too long (80 characters max).",
  "platform.plan_required": "Refused: --plan is required.",
  "platform.plan_too_long": "Refused: --plan is too long (40 characters max).",
  "platform.note_too_long": "Refused: --note is too long (200 characters max).",
  "platform.amount_invalid": "Refused: --amount must be a USD amount like 25 or 25.50.",
  "platform.actor_required": "Refused: no actor.",
  "platform.tenant_not_found": "Refused: no tenant with that slug.",
  "platform.already_suspended": "Refused: the tenant is already suspended.",
  "platform.not_suspended": "Refused: the tenant is not suspended.",
  "platform.reason_required": "Refused: --reason is required.",
  "platform.reason_too_long": "Refused: --reason is too long (200 characters max).",
};

export function describeError(error: unknown): string {
  if (error instanceof DomainError) return MESSAGES[error.key] ?? `Refused: ${error.key}`;
  return error instanceof Error ? error.message : String(error);
}

function fail(message: string): never {
  throw new Error(message);
}

function paidUntilDate(value: string | undefined, required: boolean): Date | null {
  if (value === undefined) return required ? fail("Refused: --paid-until YYYY-MM-DD is required.") : null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!date || date.toISOString().slice(0, 10) !== value) {
    fail("Refused: --paid-until must be a date YYYY-MM-DD.");
  }
  return date;
}

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "-");

export async function runPlatformCommand(argv: string[], ctx: CliContext): Promise<void> {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true; strict: true; args: string[] }>>;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  const [group, command, target, ...extra] = positionals;
  if (extra.length > 0) fail(USAGE);
  const { io } = ctx;

  try {
    if (group === "tenants" && command === "list" && !target) {
      const rows = await listTenants({ now: ctx.now });
      io.print(["slug", "name", "status", "plan", "paid-until", "created", "pitches", "bookings-30d"].join("\t"));
      for (const row of rows) {
        io.print(
          [
            row.slug,
            row.name,
            row.status,
            row.plan ?? "-",
            `${day(row.paidUntil)}${row.overdue ? " OVERDUE" : ""}`,
            day(row.createdAt),
            String(row.pitchCount),
            String(row.bookingsLast30Days),
          ].join("\t"),
        );
      }
      return;
    }

    if (group === "tenants" && command === "create" && !target) {
      requireInteractive(ctx.interactive);
      const input = {
        slug: values.slug ?? fail("Refused: --slug is required."),
        name: values.name ?? fail("Refused: --name is required."),
        plan: values.plan ?? null,
        paidUntil: paidUntilDate(values["paid-until"], false),
        ownerIdentifier: values["owner-identifier"] ?? null,
        actor: ctx.actor,
      };
      // Fail on bad arguments before asking anything.
      validateCreateTenantInput(input);
      await confirmDatabase(io, ctx.databaseUrl);
      const ownerPassword = await askNewPassword(io);
      const created = await createTenant({ ...input, ownerPassword });
      io.print(`created ${created.slug} (owner login: ${created.ownerIdentifier})`);
      return;
    }

    if (group === "tenants" && (command === "suspend" || command === "resume") && target) {
      requireInteractive(ctx.interactive);
      if (command === "suspend" && !values.reason?.trim()) fail("Refused: --reason is required.");
      await confirmDatabase(io, ctx.databaseUrl);
      await confirmTyped(io, "slug", target);
      if (command === "suspend") {
        await suspendTenant({ slug: target, reason: values.reason ?? "", actor: ctx.actor });
        io.print(`suspended ${target}`);
      } else {
        await resumeTenant({ slug: target, actor: ctx.actor });
        io.print(`resumed ${target}`);
      }
      return;
    }

    if (group === "subscriptions" && command === "set" && target) {
      requireInteractive(ctx.interactive);
      const paidUntil = paidUntilDate(values["paid-until"], true)!;
      const plan = values.plan ?? fail("Refused: --plan is required.");
      await confirmDatabase(io, ctx.databaseUrl);
      await setSubscription({
        slug: target,
        plan,
        paidUntil,
        amountUsd: values.amount ?? null,
        note: values.note ?? null,
        actor: ctx.actor,
      });
      io.print(`subscription recorded for ${target}`);
      return;
    }
  } catch (error) {
    if (error instanceof DomainError) throw new Error(describeError(error), { cause: error });
    throw error;
  }

  fail(USAGE);
}
