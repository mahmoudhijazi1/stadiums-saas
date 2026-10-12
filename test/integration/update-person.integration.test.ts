import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { searchPeople } from "@/modules/people/application/search-people";
import { updatePersonDetails } from "@/modules/people/application/update-person";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Editing a person: rename (name and searchName), phone (canonical, unique per stadium, never
 * cleared), owner only, tenant-scoped. Written, not run when authored: unverified until
 * `npm run test:integration` has run.
 */
let a: TestFixture;
let b: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
  actAs(a);
});

function actAs(fixture: TestFixture, token: string = fixture.sessionId) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(token);
}

async function person(fixture: TestFixture, name: string, phone: string) {
  actAs(fixture);
  const row = await db.$transaction((tx) => findOrCreatePerson(tx, { name, phone }));
  return row.id;
}

const stored = (id: string) => platformDb.person.findUniqueOrThrow({ where: { id } });

describe("updatePersonDetails", () => {
  it("renames: the name and the search form change, and the search finds the new name", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await updatePersonDetails({ personId: id, name: "  Hussein   Ali " });
    const row = await stored(id);
    expect(row.name).toBe("Hussein Ali");
    expect(row.searchName).toContain("hussein");
    expect((await searchPeople("Hussein")).map((hit) => hit.id)).toEqual([id]);
    expect(await searchPeople("Hasan")).toEqual([]);
    expect(row.phone).toBe("96171000001"); // an absent phone leaves the phone alone
  });

  it("stores a typed Lebanese phone as canonical digits", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await updatePersonDetails({ personId: id, name: "Hasan", phone: "71 123 456" });
    expect((await stored(id)).phone).toBe("96171123456");
  });

  it("accepts a number from another country with its code", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await updatePersonDetails({ personId: id, name: "Hasan", phone: "0933123456", country: "963" });
    expect((await stored(id)).phone).toBe("963933123456");
  });

  it("refuses a phone another person of this stadium has, naming them, and changes nothing", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await person(a, "Sami", "96171123456");
    const rejected = await updatePersonDetails({ personId: id, name: "New Name", phone: "71123456" }).catch((e) => e);
    expect(rejected).toMatchObject({ key: "people.phone_taken", params: { name: "Sami" } });
    const row = await stored(id);
    expect(row.name).toBe("Hasan");
    expect(row.phone).toBe("96171000001");
  });

  it("allows the same phone at another stadium", async () => {
    await person(b, "Elsewhere", "96171123456");
    const id = await person(a, "Hasan", "96171000001");
    actAs(a);
    await updatePersonDetails({ personId: id, name: "Hasan", phone: "71123456" });
    expect((await stored(id)).phone).toBe("96171123456");
  });

  it("refuses a bad phone", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await expect(updatePersonDetails({ personId: id, name: "Hasan", phone: "12ab" })).rejects.toMatchObject({
      key: "people.phone_invalid",
    });
    expect((await stored(id)).phone).toBe("96171000001");
  });

  it("refuses to clear a saved phone, and leaves a person without a phone alone", async () => {
    const id = await person(a, "Hasan", "96171000001");
    await expect(updatePersonDetails({ personId: id, name: "Renamed", phone: "" })).rejects.toMatchObject({
      key: "people.phone_required",
    });
    const row = await stored(id);
    expect(row.phone).toBe("96171000001");
    expect(row.name).toBe("Hasan");

    const bare = await platformDb.person.create({
      data: { tenantId: a.tenantId, name: "No Phone", phone: null, searchName: "no phone" },
    });
    await updatePersonDetails({ personId: bare.id, name: "Now Named", phone: "" });
    const after = await stored(bare.id);
    expect(after.name).toBe("Now Named");
    expect(after.phone).toBeNull();
  });

  it("fixes a person whose stored phone is not canonical by entering a valid one", async () => {
    const old = await platformDb.person.create({
      data: { tenantId: a.tenantId, name: "Legacy", phone: "0933123456", searchName: "legacy" },
    });
    await updatePersonDetails({ personId: old.id, name: "Legacy", phone: "0933123456", country: "963" });
    expect((await stored(old.id)).phone).toBe("963933123456");
  });

  it("is owner only: staff are refused, even with every flag, and nothing is written", async () => {
    const id = await person(a, "Hasan", "96171000001");
    const staff = await createStaffSession(a.tenantId, { "people.edit": true, "settings.manage": true });
    actAs(a, staff);
    await expect(updatePersonDetails({ personId: id, name: "Hacked" })).rejects.toMatchObject({ key: "access.not_allowed" });
    expect((await stored(id)).name).toBe("Hasan");
  });

  it("does not find a person of another stadium", async () => {
    const foreign = await person(b, "Foreign", "96171555555");
    actAs(a);
    await expect(updatePersonDetails({ personId: foreign, name: "Mine now" })).rejects.toMatchObject({ key: "people.not_found" });
    expect((await stored(foreign)).name).toBe("Foreign");
  });
});
