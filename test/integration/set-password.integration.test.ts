import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { verifyPassword } from "@/modules/access/infrastructure/password";
import { createSession } from "@/modules/access/infrastructure/sessions";
import { listAccounts, setPassword, type SetPasswordIo } from "../../scripts/set-password-core";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * scripts/set-password.ts (operator tool). The core runs against stadiums_test
 * with scripted answers instead of a terminal.
 */
const NEW_PASSWORD = "correct horse battery";

let fixture: TestFixture;
let other: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  other = await seedMinimalFixture({
    tenantSlug: "other-stadium",
    tenantName: "Other",
    pitchName: "PO",
    ownerIdentifier: "owner@other-stadium",
  });
  // A second live session for the target user.
  await createSession(fixture.ownerUserId, new Date(Date.now() + 86_400_000));
});

/** Answers in order; records what was asked (hidden or not) and what was printed. */
function scriptedIo(answers: string[]) {
  const asked: { question: string; hidden: boolean }[] = [];
  const printed: string[] = [];
  const said: string[] = [];
  const io: SetPasswordIo = {
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

const databaseUrl = () => process.env.DATABASE_URL;

async function ownerHash() {
  const user = await platformDb.user.findUniqueOrThrow({ where: { id: fixture.ownerUserId } });
  return user.passwordHash;
}

describe("setPassword", () => {
  it("shows the database name and refuses when the typed name is wrong; nothing changes", async () => {
    const before = await ownerHash();
    const { io, said } = scriptedIo(["stadiums_dev", NEW_PASSWORD, NEW_PASSWORD]);
    await expect(setPassword(fixture.ownerIdentifier, databaseUrl(), io)).rejects.toThrow(/database/i);
    expect(said.join("\n")).toContain("stadiums_test");
    expect(await ownerHash()).toBe(before);
    expect(await platformDb.session.count({ where: { userId: fixture.ownerUserId } })).toBe(2);
  });

  it("refuses a password shorter than 12 characters; nothing changes", async () => {
    const before = await ownerHash();
    const { io } = scriptedIo(["stadiums_test", "short-11chr", "short-11chr"]);
    await expect(setPassword(fixture.ownerIdentifier, databaseUrl(), io)).rejects.toThrow(/12/);
    expect(await ownerHash()).toBe(before);
    expect(await platformDb.session.count({ where: { userId: fixture.ownerUserId } })).toBe(2);
  });

  it("refuses when the two entries differ", async () => {
    const before = await ownerHash();
    const { io } = scriptedIo(["stadiums_test", NEW_PASSWORD, `${NEW_PASSWORD}!`]);
    await expect(setPassword(fixture.ownerIdentifier, databaseUrl(), io)).rejects.toThrow(/match/i);
    expect(await ownerHash()).toBe(before);
  });

  it("refuses an unknown identifier", async () => {
    const { io } = scriptedIo(["stadiums_test", NEW_PASSWORD, NEW_PASSWORD]);
    await expect(setPassword("nobody@test-stadium", databaseUrl(), io)).rejects.toThrow(/no user/i);
  });

  it("sets the hash, deletes every session of that user only, and prints only 'updated <identifier>'", async () => {
    const { io, asked, printed } = scriptedIo(["stadiums_test", NEW_PASSWORD, NEW_PASSWORD]);
    await setPassword(fixture.ownerIdentifier, databaseUrl(), io);

    expect(await verifyPassword(NEW_PASSWORD, await ownerHash())).toBe(true);
    expect(await verifyPassword("test-owner-password", await ownerHash())).toBe(false);
    expect(await platformDb.session.count({ where: { userId: fixture.ownerUserId } })).toBe(0);
    expect(await platformDb.session.count({ where: { userId: other.ownerUserId } })).toBe(1);

    expect(printed).toEqual([`updated ${fixture.ownerIdentifier}`]);
    // Database confirmation is visible; both password prompts are hidden.
    expect(asked.map((entry) => entry.hidden)).toEqual([false, true, true]);
  });
});

describe("listAccounts", () => {
  it("prints identifier, role and tenant slug only, never a hash", async () => {
    const printed: string[] = [];
    await listAccounts((line) => printed.push(line));
    expect(printed).toEqual([
      "owner@other-stadium\tOWNER\tother-stadium",
      "owner@test-stadium\tOWNER\ttest-stadium",
    ]);
    const hashes = await platformDb.user.findMany({ select: { passwordHash: true } });
    for (const { passwordHash } of hashes) {
      expect(printed.join("\n")).not.toContain(passwordHash.split(":")[1]!.slice(0, 16));
    }
  });
});
