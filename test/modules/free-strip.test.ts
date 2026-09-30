import { describe, expect, it } from "@jest/globals";
import {
  buildFreeStrip,
  pendingKey,
  type FreeStripSlot,
} from "@/modules/booking/domain/free-strip";

const NOW = new Date("2026-10-02T14:00:00Z");

function slot(pitchId: string, startIso: string, priceUsd = "30.00"): FreeStripSlot {
  const end = new Date(new Date(startIso).getTime() + 3_600_000).toISOString();
  return {
    pitchId,
    pitchName: `Pitch ${pitchId}`,
    defaultPriceUsd: "30.00",
    startIso,
    endIso: end,
    startLocal: startIso.slice(11, 16),
    endLocal: end.slice(11, 16),
    priceUsd,
  };
}

const range = (pitchId: string, startIso: string) => ({
  pitchId,
  start: new Date(startIso),
  end: new Date(new Date(startIso).getTime() + 3_600_000),
});

describe("buildFreeStrip", () => {
  const slots = ["15:00", "16:00", "17:00", "18:00"].map((h) =>
    slot("a", `2026-10-02T${h}:00Z`),
  );

  it("hides started slots (start <= now) and keeps later ones", () => {
    const result = buildFreeStrip(slots, [], new Map(), new Date("2026-10-02T16:00:00Z"));
    expect(result[0]!.chips.map((c) => c.startLocal)).toEqual(["17:00", "18:00"]);
  });

  it("hides slots overlapped by an APPROVED booking only", () => {
    const result = buildFreeStrip(
      slots,
      [range("a", "2026-10-02T16:00:00Z"), range("b", "2026-10-02T17:00:00Z")],
      new Map(),
      NOW,
    );
    expect(result[0]!.chips.map((c) => c.startLocal)).toEqual(["15:00", "17:00", "18:00"]);
  });

  it("keeps slots with pending requests and reports the count", () => {
    const pending = new Map([[pendingKey("a", "2026-10-02T17:00:00Z"), 2]]);
    const chips = buildFreeStrip(slots, [], pending, NOW)[0]!.chips;
    expect(chips.map((c) => c.pending)).toEqual([0, 0, 2, 0]);
  });

  it("keeps post-midnight slots of a 22:00-02:00 window, in order", () => {
    const night = ["22:00", "23:00"]
      .map((h) => slot("a", `2026-10-02T${h}:00Z`))
      .concat(["00:00", "01:00"].map((h) => slot("a", `2026-10-03T${h}:00Z`)));
    const result = buildFreeStrip(night.reverse(), [range("a", "2026-10-03T00:00:00Z")], new Map(), NOW);
    expect(result[0]!.chips.map((c) => c.startIso)).toEqual([
      "2026-10-02T22:00:00Z",
      "2026-10-02T23:00:00Z",
      "2026-10-03T01:00:00Z",
    ]);
  });

  it("groups by pitch and drops pitches with no free chip", () => {
    const result = buildFreeStrip(
      [slot("a", "2026-10-02T17:00:00Z"), slot("b", "2026-10-02T17:00:00Z"), slot("b", "2026-10-02T18:00:00Z")],
      [range("a", "2026-10-02T17:00:00Z")],
      new Map(),
      NOW,
    );
    expect(result.map((p) => [p.pitchId, p.chips.length])).toEqual([["b", 2]]);
  });

  it("shows a price only when it differs from the pitch default", () => {
    const result = buildFreeStrip(
      [slot("a", "2026-10-02T17:00:00Z", "30"), slot("a", "2026-10-02T18:00:00Z", "40.00")],
      [],
      new Map(),
      NOW,
    );
    expect(result[0]!.chips.map((c) => c.priceUsd)).toEqual([null, "40.00"]);
  });
});
