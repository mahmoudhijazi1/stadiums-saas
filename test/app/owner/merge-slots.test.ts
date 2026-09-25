import { describe, expect, it } from "@jest/globals";
import {
  interestsForGroup,
  interestsWithoutPending,
  mergeByTime,
} from "@/app/owner/(app)/requests/merge-slots";

const pitch = "pitch-a";

function at(iso: string): Date {
  return new Date(iso);
}

describe("interestsWithoutPending", () => {
  it("keeps an open interest that does not overlap a pending request", () => {
    const interest = {
      pitchId: pitch,
      start: at("2026-09-26T18:00:00.000Z"),
      end: at("2026-09-26T19:00:00.000Z"),
    };
    const pending = {
      pitchId: pitch,
      start: at("2026-09-26T16:00:00.000Z"),
      end: at("2026-09-26T17:00:00.000Z"),
    };
    expect(interestsWithoutPending([interest], [pending])).toEqual([interest]);
  });

  it("drops an interest that overlaps a pending request on the same pitch", () => {
    const interest = {
      pitchId: pitch,
      start: at("2026-09-26T18:00:00.000Z"),
      end: at("2026-09-26T19:00:00.000Z"),
    };
    const pending = {
      pitchId: pitch,
      start: at("2026-09-26T18:00:00.000Z"),
      end: at("2026-09-26T19:00:00.000Z"),
    };
    expect(interestsWithoutPending([interest], [pending])).toEqual([]);
  });
});

describe("mergeByTime", () => {
  it("places an earlier interest before a later request", () => {
    const interest = { personId: "p1", createdAt: at("2026-09-25T10:00:00.000Z") };
    const request = { id: "b1", requestedAt: at("2026-09-25T12:00:00.000Z") };
    expect(mergeByTime([request], [interest])).toEqual([
      { kind: "interest", interest },
      { kind: "request", request },
    ]);
  });
});

describe("interestsForGroup", () => {
  it("collects people from an overlapping window on the same pitch", () => {
    const person = { personId: "p1", createdAt: at("2026-09-25T10:00:00.000Z") };
    const group = {
      pitchId: pitch,
      start: at("2026-09-26T18:00:00.000Z"),
      end: at("2026-09-26T19:00:00.000Z"),
    };
    expect(
      interestsForGroup(group, [{ ...group, people: [person] }]),
    ).toEqual([person]);
  });
});
