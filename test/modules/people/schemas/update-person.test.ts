import { describe, expect, it } from "@jest/globals";
import { ZodError } from "zod";
import { parseUpdatePerson } from "@/modules/people/schemas/update-person";

/** Written, not run. The edit of a person: id, name, optional phone and country. */
describe("parseUpdatePerson", () => {
  it("accepts an id and a name, with the phone and country optional", () => {
    expect(parseUpdatePerson({ personId: "p1", name: "Hassan" })).toEqual({ personId: "p1", name: "Hassan" });
    expect(parseUpdatePerson({ personId: "p1", name: "Hassan", phone: "71 123 456", country: "961" })).toEqual({
      personId: "p1",
      name: "Hassan",
      phone: "71 123 456",
      country: "961",
    });
  });

  it("cleans the name like every other person name", () => {
    expect(parseUpdatePerson({ personId: "p1", name: "  Ali ‮  Saleh \n" }).name).toBe("Ali Saleh");
  });

  it("allows an empty phone (the use case decides whether that is allowed)", () => {
    expect(parseUpdatePerson({ personId: "p1", name: "Hassan", phone: "" }).phone).toBe("");
  });

  it("refuses an empty or blank name, a missing id, an unknown country and extra keys", () => {
    for (const bad of [
      { personId: "p1", name: "" },
      { personId: "p1", name: "   " },
      { name: "Hassan" },
      { personId: "", name: "Hassan" },
      { personId: "p1", name: "Hassan", country: "999" },
      { personId: "p1", name: "Hassan", tenantId: "t1" },
      { personId: "p1", name: "x".repeat(81) },
      { personId: "p1", name: "Hassan", phone: "1".repeat(41) },
    ]) {
      expect(() => parseUpdatePerson(bad)).toThrow(ZodError);
    }
  });
});
