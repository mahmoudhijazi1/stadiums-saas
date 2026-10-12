import QRCode from "qrcode";
import {
  beginAdminTotp,
  createPlatformAdmin,
  finishAdminTotp,
  listPlatformAdmins,
  resetAdminTotp,
  setPlatformAdminPassword,
} from "@/modules/platform/application/platform-admins";
import { askNewPassword, confirmDatabase, confirmTyped, requireInteractive, type OperatorIo } from "./lib/operator-io";

/**
 * `platform.ts admins ...` (DR-006): the web platform admin's accounts. Prompts, confirmations and
 * output live here; the use cases in src/modules/platform/application/platform-admins.ts take an
 * explicit actor and never touch the terminal. A password is never an argument. The only secret
 * ever printed is the enrollment QR and otpauth URI, once, by `enroll-totp`.
 */
export type AdminsContext = {
  io: OperatorIo;
  interactive: boolean;
  databaseUrl: string | undefined;
  actor: string;
  now?: Date;
};

/** Operator-facing text for the admin domain keys (merged into the platform CLI's table). */
export const ADMIN_MESSAGES: Record<string, string> = {
  "platform.admin_identifier_invalid": "Refused: the identifier must be 3-40 characters of a-z, 0-9, dot, underscore or hyphen.",
  "platform.admin_identifier_taken": "Refused: that admin identifier is already used.",
  "platform.admin_password_too_short": "Refused: an admin password must be at least 16 characters.",
  "platform.admin_not_found": "Refused: no admin with that identifier.",
  "platform.admin_already_enrolled": "Refused: that admin already has a second factor. Run reset-totp first.",
  "platform.totp_invalid": "Refused: that code is not valid right now. Check the phone's clock and try again.",
};

/** Two hidden prompts, the shared policy, then the admin minimum of 16 before anything is saved. */
async function askAdminPassword(io: OperatorIo, identifier: string): Promise<string> {
  const password = await askNewPassword(io, { identifier });
  if ([...password].length < 16) throw new Error(ADMIN_MESSAGES["platform.admin_password_too_short"]);
  return password;
}

export async function runAdminsCommand(command: string | undefined, target: string | undefined, ctx: AdminsContext): Promise<boolean> {
  const { io } = ctx;

  if (command === "list" && !target) {
    const rows = await listPlatformAdmins();
    io.print(["identifier", "enrolled", "created"].join("\t"));
    for (const row of rows) {
      io.print([row.identifier, row.enrolled ? "yes" : "no", row.createdAt.toISOString().slice(0, 10)].join("\t"));
    }
    return true;
  }

  if (!target) return false;

  if (command === "create") {
    requireInteractive(ctx.interactive);
    await confirmDatabase(io, ctx.databaseUrl);
    const password = await askAdminPassword(io, target.trim().toLowerCase());
    await createPlatformAdmin({ identifier: target, password, actor: ctx.actor });
    io.print(`created admin ${target.trim().toLowerCase()} (not enrolled yet: run enroll-totp)`);
    return true;
  }

  if (command === "enroll-totp") {
    requireInteractive(ctx.interactive);
    await confirmDatabase(io, ctx.databaseUrl);
    const { secretBase32, uri } = await beginAdminTotp({ identifier: target });
    io.say("Scan this QR with an authenticator app (or enter the URI by hand). It is shown once.");
    io.print(await QRCode.toString(uri, { type: "terminal", small: true }));
    io.print(uri);
    const code = await io.ask("Current 6-digit code: ", { hidden: false });
    await finishAdminTotp({ identifier: target, secretBase32, code, actor: ctx.actor, now: ctx.now });
    io.print(`enrolled ${target.trim().toLowerCase()}`);
    return true;
  }

  if (command === "reset-totp") {
    requireInteractive(ctx.interactive);
    await confirmDatabase(io, ctx.databaseUrl);
    await confirmTyped(io, "identifier", target.trim().toLowerCase());
    await resetAdminTotp({ identifier: target, actor: ctx.actor });
    io.print(`reset the second factor of ${target.trim().toLowerCase()} and ended its sessions (run enroll-totp)`);
    return true;
  }

  if (command === "set-password") {
    requireInteractive(ctx.interactive);
    await confirmDatabase(io, ctx.databaseUrl);
    const password = await askAdminPassword(io, target.trim().toLowerCase());
    await setPlatformAdminPassword({ identifier: target, password, actor: ctx.actor });
    io.print(`updated ${target.trim().toLowerCase()} and ended its sessions`);
    return true;
  }

  return false;
}
