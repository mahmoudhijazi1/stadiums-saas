import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createPitch } from "@/modules/venue/application/create-pitch";
import { getPitchEditor } from "@/modules/venue/application/get-pitch-editor";
import { updatePitch } from "@/modules/venue/application/update-pitch";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import {
  hoursToRows,
  priceCardsToRules,
  rowsToHours,
  rulesToPriceCards,
} from "@/modules/venue/domain/pitch-form-model";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * The pitch editor submits the same JSON fields as before (hoursGroupsJson,
 * priceRulesJson). A pitch saved with what the new editor builds must equal one saved
 * with the old form's output.
 */
const OLD_FORM = {
  name: "Old form",
  slotDurationMinutes: "90",
  defaultPlayerCount: "10",
  defaultPriceUsd: "25",
  hoursGroups: JSON.stringify([
    { days: ["mon", "tue", "wed", "thu"], open: "16:00", close: "22:00" },
    { days: ["fri", "sat"], open: "22:00", close: "02:00" },
  ]),
  // Overlapping rows: the last one wins on Saturday.
  priceRules: JSON.stringify([
    { days: ["fri", "sat"], priceUsd: "40" },
    { days: ["sat", "sun"], priceUsd: "50" },
  ]),
};

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

/** What the new editor submits for the same configuration. */
function newEditorFields() {
  const old = parsePitchDraft(OLD_FORM);
  const rows = hoursToRows(old.hoursGroups);
  const { cards, timed } = rulesToPriceCards(old.priceRules);
  return {
    ...OLD_FORM,
    name: "New editor",
    hoursGroups: JSON.stringify(rowsToHours(rows)),
    priceRules: JSON.stringify(priceCardsToRules(cards, timed)),
  };
}

async function storedConfig(id: string) {
  const row = await platformDb.pitch.findUniqueOrThrow({ where: { id } });
  return parseScheduleConfig(row.scheduleConfig);
}

function nextWeek(config: ReturnType<typeof parseScheduleConfig>) {
  const start = civilDateInTimeZone(new Date(), "Asia/Beirut");
  const out: string[] = [];
  for (let offset = 0; offset < 14; offset += 1) {
    for (const slot of generateSlotsForDay({
      config,
      localDate: addCalendarDays(start, offset),
      timeZone: "Asia/Beirut",
      occupied: [],
    })) {
      out.push(`${slot.start.toISOString()}|${slot.end.toISOString()}|${slot.priceUsd.toFixed(2)}`);
    }
  }
  return out;
}

describe("pitch editor", () => {
  it("a pitch saved with the new editor's fields has the same availability and prices as the old form's", async () => {
    const oldPitch = await createPitch(parsePitchDraft(OLD_FORM));
    const newPitch = await createPitch(parsePitchDraft(newEditorFields()));

    const [oldConfig, newConfig] = [await storedConfig(oldPitch.id), await storedConfig(newPitch.id)];
    expect(nextWeek(newConfig)).toEqual(nextWeek(oldConfig));
    expect(nextWeek(oldConfig).length).toBeGreaterThan(20);

    // A window that closes after midnight is accepted, and Saturday's price is the last row's.
    expect(oldConfig.hours.fri).toEqual([{ start: "22:00", end: "02:00" }]);
    const editor = await getPitchEditor(newPitch.id);
    expect(editor?.hoursGroups.map((group) => group.days)).toEqual([["mon", "tue", "wed", "thu"], ["fri", "sat"]]);
  });

  it("an edit through the new fields updates the pitch the same way", async () => {
    const created = await createPitch(parsePitchDraft(OLD_FORM));
    const fields = newEditorFields();
    await updatePitch({
      pitchId: created.id,
      draft: parsePitchDraft({ ...fields, name: "Renamed" }),
      liveBookings: [],
    });
    const oldEquivalent = await createPitch(parsePitchDraft(OLD_FORM));
    expect(nextWeek(await storedConfig(created.id))).toEqual(nextWeek(await storedConfig(oldEquivalent.id)));
  });

  it("staff without settings.manage cannot create or save", async () => {
    const created = await createPitch(parsePitchDraft(OLD_FORM));
    actAs(await createStaffSession(fixture.tenantId, { "bookings.create": true }));
    await expect(createPitch(parsePitchDraft(newEditorFields()))).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(
      updatePitch({ pitchId: created.id, draft: parsePitchDraft(newEditorFields()), liveBookings: [] }),
    ).rejects.toMatchObject({ key: "access.not_allowed" });
  });

  it("another tenant's pitch id is refused", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(fixture.sessionId);
    await expect(
      updatePitch({ pitchId: other.pitchId, draft: parsePitchDraft(newEditorFields()), liveBookings: [] }),
    ).rejects.toMatchObject({ key: "booking.pitch_not_found" });
    expect(await getPitchEditor(other.pitchId)).toBeNull();
  });

  it("a suspended tenant is refused", async () => {
    await platformDb.tenant.update({ where: { id: fixture.tenantId }, data: { suspendedAt: new Date() } });
    actAs(fixture.sessionId);
    await expect(createPitch(parsePitchDraft(newEditorFields()))).rejects.toMatchObject({ key: "access.not_allowed" });
  });
});
