import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * Written, not run when authored. The Stadium info preview must be the app's real components, so
 * it cannot drift from what the owner will see: the primary Button, the day pill's real classes,
 * a link-variant Button and the real status pills, with the fixed colours next to the accent.
 */
const SOURCE = readFileSync(
  join(process.cwd(), "src", "app", "owner", "(app)", "more", "stadium", "stadium-form.tsx"),
  "utf8",
);

describe("Stadium info preview", () => {
  it("renders the real components", () => {
    expect(SOURCE).toContain('import { Button } from "@/components/ui/button"');
    expect(SOURCE).toContain('import { dayChipClass } from "@/components/day-chip-class"');
    expect(SOURCE).toContain('import { ExpectedPill, StatusPill } from "@/app/owner/booking-row"');
    expect(SOURCE).toMatch(/dayChipClass\(true\)/);
    expect(SOURCE).toMatch(/variant="link"/);
  });

  it("shows the paid, owed and expected pills beside the accent", () => {
    expect(SOURCE).toContain('kind: "paid"');
    expect(SOURCE).toContain('kind: "unpaid"');
    expect(SOURCE).toContain("<ExpectedPill");
  });

  it("keeps the line saying the status colours stay the same", () => {
    expect(SOURCE).toContain("owner.stadiumColourNote");
  });

  it("has no hand-made preview colours or classes of its own", () => {
    expect(SOURCE).not.toMatch(/pv-(button|pill|link)/);
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("is inert, so the sample controls cannot be tabbed to or clicked", () => {
    expect(SOURCE).toMatch(/<div inert className="accent-preview/);
  });

  it("the day chip classes are shared with the app's day strip", () => {
    const strip = readFileSync(join(process.cwd(), "src", "components", "day-chips.tsx"), "utf8");
    expect(strip).toContain('import { dayChipClass } from "@/components/day-chip-class"');
    expect(strip).not.toContain("function dayChipClass");
  });
});
