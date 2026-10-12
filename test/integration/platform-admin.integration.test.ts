import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { decodeBase32 } from "@/modules/platform/domain/base32";
import { stepAt, totpCode } from "@/modules/platform/domain/totp";
import { consumeTotpStep } from "@/modules/platform/infrastructure/platform-admins";
import { platformTransaction } from "@/modules/platform/infrastructure/platform-store";
import { decryptTotpSecret, loadTotpKey } from "@/modules/platform/infrastructure/totp-crypto";
import type { OperatorIo } from "../../scripts/lib/operator-io";
import { runPlatformCommand } from "../../scripts/platform-cli";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-006 slice 2: the TOTP step is accepted once (even under concurrency), and the admin CLI
 * (create, enroll-totp, reset-totp, set-password, list). Scripted answers replace a terminal.
 * Written, not run when authored: unverified until `npm run test:integration` has run.
 */
const PASSWORD = "a long admin passphrase";
const NEW_PASSWORD = "another long admin passphrase";
const ACTOR = "cli:tester@host";
const DATABASE = "stadiums_test";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

function scripted(answers: string[]) {
  const printed: string[] = [];
  const io: OperatorIo = {
    async ask(question) {
      const answer = answers.shift();
      if (answer === undefined) throw new Error(`unexpected prompt: ${question}`);
      return answer;
    },
    say: () => undefined,
    print: (line) => printed.push(line),
  };
  return { io, printed };
}

function run(argv: string[], answers: string[] = [], now = new Date()) {
  const terminal = scripted(answers);
  const promise = runPlatformCommand(argv, {
    io: terminal.io,
    interactive: true,
    databaseUrl: process.env.DATABASE_URL,
    actor: ACTOR,
    now,
  });
  return { promise, ...terminal };
}

async function createAdmin(identifier = "ops.one") {
  await run(["admins", "create", identifier], [DATABASE, PASSWORD, PASSWORD]).promise;
  // The CLI stores the identifier lowercase, so look it up that way.
  return platformDb.platformAdmin.findUniqueOrThrow({ where: { identifier: identifier.toLowerCase() } });
}

/** Enroll through the CLI: read the secret from the printed URI, answer with its current code. */
async function enroll(identifier = "ops.one", now = new Date()) {
  const terminal = scripted([DATABASE, ""]);
  const answers = terminal.io;
  let secret = "";
  const io: OperatorIo = {
    ask: async (question, options) => {
      if (/code/i.test(question)) {
        const bytes = decodeBase32(secret)!;
        return totpCode(bytes, stepAt(now.getTime() / 1000));
      }
      return answers.ask(question, options);
    },
    say: () => undefined,
    print: (line) => {
      terminal.printed.push(line);
      const match = /secret=([A-Z2-7]+)/.exec(line);
      if (match) secret = match[1]!;
    },
  };
  await runPlatformCommand(["admins", "enroll-totp", identifier], {
    io,
    interactive: true,
    databaseUrl: process.env.DATABASE_URL,
    actor: ACTOR,
    now,
  });
  return { secret, printed: terminal.printed };
}

async function auditActions() {
  return (await platformDb.platformAuditLog.findMany({ orderBy: { createdAt: "asc" } })).map((row) => row.action);
}

describe("consumeTotpStep", () => {
  it("accepts a step once, then refuses the same and any earlier step", async () => {
    const admin = await createAdmin();
    const use = (step: number) => platformTransaction((tx) => consumeTotpStep(tx, admin.id, step));
    expect(await use(100)).toBe(true);
    expect(await use(100)).toBe(false);
    expect(await use(99)).toBe(false);
    expect(await use(101)).toBe(true);
    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.lastTotpStep).toBe(BigInt(101));
  });

  it("lets exactly one of two concurrent calls with the same step succeed", async () => {
    const admin = await createAdmin();
    for (let step = 500; step < 510; step += 1) {
      const results = await Promise.all([
        platformTransaction((tx) => consumeTotpStep(tx, admin.id, step)),
        platformTransaction((tx) => consumeTotpStep(tx, admin.id, step)),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    }
  });
});

describe("admins create", () => {
  it("creates a lowercase, not-yet-enrolled admin with a hash and an audit row (no password in it)", async () => {
    const admin = await createAdmin("Ops.One");
    expect(admin.identifier).toBe("ops.one");
    expect(admin.totpSecretEnc).toBeNull();
    expect(admin.lastTotpStep).toBeNull();
    expect(admin.passwordHash).not.toContain(PASSWORD);
    expect(await auditActions()).toEqual(["admin.create"]);
    const detail = JSON.stringify((await platformDb.platformAuditLog.findFirstOrThrow()).detail);
    expect(detail).not.toContain(PASSWORD);
  });

  it("refuses a short password, a taken identifier and a bad identifier, writing nothing", async () => {
    await expect(
      run(["admins", "create", "ops.one"], [DATABASE, "only fifteen ch", "only fifteen ch"]).promise,
    ).rejects.toThrow(/16 characters/);
    await createAdmin();
    await expect(run(["admins", "create", "ops.one"], [DATABASE, PASSWORD, PASSWORD]).promise).rejects.toThrow(/already used/);
    await expect(run(["admins", "create", "x"], [DATABASE, PASSWORD, PASSWORD]).promise).rejects.toThrow(/identifier/);
    expect(await platformDb.platformAdmin.count()).toBe(1);
  });
});

describe("admins enroll-totp", () => {
  it("saves the encrypted secret and the step only after a valid code, and audits without the secret", async () => {
    const admin = await createAdmin();
    const now = new Date("2026-10-15T10:00:00Z");
    const { secret, printed } = await enroll("ops.one", now);
    expect(printed.some((line) => line.startsWith("otpauth://totp/lebstads:ops.one"))).toBe(true);
    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.totpSecretEnc).not.toBeNull();
    expect(row.totpSecretEnc).not.toContain(secret);
    expect(decryptTotpSecret(row.totpSecretEnc!, loadTotpKey(), admin.id)).toBe(secret);
    expect(row.lastTotpStep).toBe(BigInt(stepAt(now.getTime() / 1000)));
    expect(await auditActions()).toEqual(["admin.create", "admin.enroll_totp"]);
    const details = JSON.stringify((await platformDb.platformAuditLog.findMany()).map((entry) => entry.detail));
    expect(details).not.toContain(secret);
  });

  it("saves nothing on a wrong code, and refuses an admin who is already enrolled", async () => {
    const admin = await createAdmin();
    await expect(run(["admins", "enroll-totp", "ops.one"], [DATABASE, "000000"]).promise).rejects.toThrow(/not valid/);
    expect((await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } })).totpSecretEnc).toBeNull();
    await enroll();
    await expect(run(["admins", "enroll-totp", "ops.one"], [DATABASE]).promise).rejects.toThrow(/already has a second factor/);
  });
});

async function seedSessions(adminId: string) {
  const expiresAt = new Date(Date.now() + 3_600_000);
  await platformDb.platformSession.createMany({
    data: [
      { adminId, tokenHash: `hash-a-${adminId}`, expiresAt },
      { adminId, tokenHash: `hash-b-${adminId}`, expiresAt },
    ],
  });
}

describe("admins reset-totp and set-password", () => {
  it("reset-totp clears the secret, deletes that admin's sessions only, and audits", async () => {
    const admin = await createAdmin();
    const other = await createAdmin("ops.two");
    await enroll();
    await seedSessions(admin.id);
    await seedSessions(other.id);

    await run(["admins", "reset-totp", "ops.one"], [DATABASE, "ops.one"]).promise;

    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.totpSecretEnc).toBeNull();
    expect(row.lastTotpStep).toBeNull();
    expect(await platformDb.platformSession.count({ where: { adminId: admin.id } })).toBe(0);
    expect(await platformDb.platformSession.count({ where: { adminId: other.id } })).toBe(2);
    expect((await auditActions()).at(-1)).toBe("admin.reset_totp");
  });

  it("reset-totp stops, changing nothing, when the identifier is not typed back", async () => {
    const admin = await createAdmin();
    await enroll();
    await seedSessions(admin.id);
    await expect(run(["admins", "reset-totp", "ops.one"], [DATABASE, "wrong"]).promise).rejects.toThrow(/does not match/);
    expect((await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } })).totpSecretEnc).not.toBeNull();
    expect(await platformDb.platformSession.count({ where: { adminId: admin.id } })).toBe(2);
  });

  it("set-password changes the hash, deletes that admin's sessions, and audits", async () => {
    const admin = await createAdmin();
    await seedSessions(admin.id);
    const before = admin.passwordHash;

    await run(["admins", "set-password", "ops.one"], [DATABASE, NEW_PASSWORD, NEW_PASSWORD]).promise;

    const row = await platformDb.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.passwordHash).not.toBe(before);
    expect(await platformDb.platformSession.count({ where: { adminId: admin.id } })).toBe(0);
    expect((await auditActions()).at(-1)).toBe("admin.set_password");
    expect(JSON.stringify((await platformDb.platformAuditLog.findMany()).map((entry) => entry.detail))).not.toContain(NEW_PASSWORD);
  });

  it("refuses an unknown admin", async () => {
    await expect(run(["admins", "reset-totp", "nobody"], [DATABASE, "nobody"]).promise).rejects.toThrow(/no admin/);
  });
});

describe("admins list", () => {
  it("shows identifier, enrolled and created, and never a hash or a secret", async () => {
    await createAdmin();
    await createAdmin("ops.two");
    await enroll("ops.two");
    const { promise, printed } = run(["admins", "list"]);
    await promise;
    expect(printed[0]).toBe("identifier\tenrolled\tcreated");
    expect(printed[1]).toMatch(/^ops\.one\tno\t\d{4}-\d{2}-\d{2}$/);
    expect(printed[2]).toMatch(/^ops\.two\tyes\t\d{4}-\d{2}-\d{2}$/);
    expect(printed.join("\n")).not.toMatch(/scrypt|v1\./);
  });
});

describe("the admin tables", () => {
  it("store the identifier lowercase (the CHECK refuses anything else)", async () => {
    await expect(
      platformDb.platformAdmin.create({ data: { identifier: "UPPER", passwordHash: "x" } }),
    ).rejects.toBeDefined();
  });

  it("delete their sessions with the admin", async () => {
    const admin = await createAdmin();
    await seedSessions(admin.id);
    await platformDb.platformAdmin.delete({ where: { id: admin.id } });
    expect(await platformDb.platformSession.count()).toBe(0);
  });
});
