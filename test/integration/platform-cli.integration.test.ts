import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import type { OperatorIo } from "../../scripts/lib/operator-io";
import { runPlatformCommand } from "../../scripts/platform-cli";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * scripts/platform.ts: argument parsing, confirmations and output live here,
 * never in the use cases (decision 12). Scripted answers replace a terminal.
 */
const PASSWORD = "a long owner password";
const ACTOR = "cli:tester@host";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

function scripted(answers: string[]) {
  const asked: { question: string; hidden: boolean }[] = [];
  const printed: string[] = [];
  const said: string[] = [];
  const io: OperatorIo = {
    async ask(question, { hidden }) {
      asked.push({ question, hidden });
      const answer = answers.shift();
      if (answer === undefined) throw new Error(`unexpected prompt: ${question}`);
      return answer;
    },
    say: (line) => said.push(line),
    print: (line) => printed.push(line),
  };
  return { io, asked, printed, said };
}

function run(argv: string[], answers: string[] = [], interactive = true) {
  const terminal = scripted(answers);
  const promise = runPlatformCommand(argv, {
    io: terminal.io,
    interactive,
    databaseUrl: process.env.DATABASE_URL,
    actor: ACTOR,
  });
  return { promise, ...terminal };
}

async function createAlNour() {
  const { promise } = run(
    ["tenants", "create", "--slug", "al-nour", "--name", "Al Nour", "--paid-until", "2026-12-31"],
    ["stadiums_test", PASSWORD, PASSWORD],
  );
  await promise;
}

async function auditActions() {
  return (await platformDb.platformAuditLog.findMany({ orderBy: { createdAt: "asc" } })).map((row) => row.action);
}

describe("tenants create", () => {
  it("shows the DB name, requires typing it, asks the password hidden twice, prints no secret", async () => {
    const { promise, asked, printed, said } = run(
      ["tenants", "create", "--slug", "al-nour", "--name", "Al Nour", "--plan", "trial"],
      ["stadiums_test", PASSWORD, PASSWORD],
    );
    await promise;
    expect(said.join("\n")).toContain("stadiums_test");
    expect(asked.map((entry) => entry.hidden)).toEqual([false, true, true]);
    expect(printed.join("\n")).toContain("owner@al-nour");
    expect(printed.join("\n")).not.toContain(PASSWORD);
    expect(await auditActions()).toEqual(["tenant.create"]);
    const audit = await platformDb.platformAuditLog.findFirstOrThrow();
    expect(audit.actor).toBe(ACTOR);
  });

  it("a wrong database name refuses and creates nothing", async () => {
    const { promise } = run(["tenants", "create", "--slug", "al-nour", "--name", "Al Nour"], ["stadiums_dev"]);
    await expect(promise).rejects.toThrow(/database/i);
    expect(await platformDb.tenant.count()).toBe(0);
    expect(await platformDb.platformAuditLog.count()).toBe(0);
  });

  it("refuses when not interactive, before asking anything", async () => {
    const { promise, asked } = run(["tenants", "create", "--slug", "al-nour", "--name", "Al Nour"], [], false);
    await expect(promise).rejects.toThrow(/interactive/);
    expect(asked).toEqual([]);
    expect(await platformDb.tenant.count()).toBe(0);
  });

  it("stores --day-start-hour in the tenant settings", async () => {
    const { promise } = run(
      ["tenants", "create", "--slug", "al-nour", "--name", "Al Nour", "--day-start-hour", "3"],
      ["stadiums_test", PASSWORD, PASSWORD],
    );
    await promise;
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
    expect((tenant.settings as { dayStartHour?: number }).dayStartHour).toBe(3);
  });

  it("refuses --day-start-hour outside 0 to 6 before any prompt", async () => {
    for (const bad of ["7", "-1", "2.5", "six"]) {
      const { promise, asked } = run(
        ["tenants", "create", "--slug", "al-nour", "--name", "Al Nour", "--day-start-hour", bad],
      );
      await expect(promise).rejects.toThrow(/day-start-hour/);
      expect(asked).toEqual([]);
    }
    expect(await platformDb.tenant.count()).toBe(0);
  });

  it("refuses an invalid slug before any prompt", async () => {
    const { promise, asked } = run(["tenants", "create", "--slug", "www", "--name", "X"]);
    await expect(promise).rejects.toThrow(/slug/i);
    expect(asked).toEqual([]);
  });

  it("refuses a short password and creates nothing", async () => {
    const { promise } = run(["tenants", "create", "--slug", "al-nour", "--name", "Al Nour"], ["stadiums_test", "short", "short"]);
    await expect(promise).rejects.toThrow(/12/);
    expect(await platformDb.tenant.count()).toBe(0);
  });
});

describe("tenants suspend / resume", () => {
  it("require the DB name and the slug typed; one audit row each", async () => {
    await createAlNour();
    const wrongSlug = run(["tenants", "suspend", "al-nour", "--reason", "Unpaid"], ["stadiums_test", "al-nur"]);
    await expect(wrongSlug.promise).rejects.toThrow(/slug/i);
    expect((await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } })).suspendedAt).toBeNull();

    const suspend = run(["tenants", "suspend", "al-nour", "--reason", "Unpaid"], ["stadiums_test", "al-nour"]);
    await suspend.promise;
    expect(suspend.printed).toEqual(["suspended al-nour"]);
    const resume = run(["tenants", "resume", "al-nour"], ["stadiums_test", "al-nour"]);
    await resume.promise;
    expect(resume.printed).toEqual(["resumed al-nour"]);
    expect(await auditActions()).toEqual(["tenant.create", "tenant.suspend", "tenant.resume"]);
  });

  it("refuse when not interactive", async () => {
    await createAlNour();
    await expect(run(["tenants", "suspend", "al-nour", "--reason", "x"], [], false).promise).rejects.toThrow(/interactive/);
    await expect(run(["tenants", "resume", "al-nour"], [], false).promise).rejects.toThrow(/interactive/);
  });

  it("suspend needs --reason", async () => {
    await createAlNour();
    await expect(run(["tenants", "suspend", "al-nour"], ["stadiums_test", "al-nour"]).promise).rejects.toThrow(/reason/i);
  });
});

describe("subscriptions set", () => {
  it("appends a subscription after the DB confirmation; refuses non-interactive", async () => {
    await createAlNour();
    await expect(
      run(["subscriptions", "set", "al-nour", "--plan", "basic", "--paid-until", "2027-01-31"], [], false).promise,
    ).rejects.toThrow(/interactive/);
    const { promise, printed } = run(
      ["subscriptions", "set", "al-nour", "--plan", "basic", "--paid-until", "2027-01-31", "--amount", "25", "--note", "cash"],
      ["stadiums_test"],
    );
    await promise;
    expect(printed).toEqual(["subscription recorded for al-nour"]);
    expect(await platformDb.subscription.count()).toBe(2);
    expect(await auditActions()).toEqual(["tenant.create", "subscription.set"]);
  });

  it("rejects a malformed --paid-until", async () => {
    await createAlNour();
    await expect(
      run(["subscriptions", "set", "al-nour", "--plan", "basic", "--paid-until", "31/01/2027"], ["stadiums_test"]).promise,
    ).rejects.toThrow(/paid-until/);
  });
});

describe("tenants list", () => {
  it("works without a terminal and prints no secrets", async () => {
    await createAlNour();
    await platformDb.session.create({ data: { userId: (await platformDb.user.findFirstOrThrow()).id, tokenHash: "f".repeat(64), expiresAt: new Date(Date.now() + 1e9) } });
    const { promise, printed, asked } = run(["tenants", "list"], [], false);
    await promise;
    expect(asked).toEqual([]);
    const output = printed.join("\n");
    expect(output).toContain("al-nour");
    expect(output).toContain("ACTIVE");
    expect(output).toContain("2026-12-31");
    expect(output).not.toMatch(/scrypt:|f{64}|owner@/);
    expect(await platformDb.platformAuditLog.count()).toBe(1); // list writes nothing
  });
});

describe("usage", () => {
  it("rejects unknown commands and unknown flags", async () => {
    await expect(run(["tenants", "rename", "al-nour"]).promise).rejects.toThrow(/Usage/);
    await expect(run(["tenants", "list", "--password", "x"]).promise).rejects.toThrow();
  });
});
