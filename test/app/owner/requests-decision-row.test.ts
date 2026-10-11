import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), "src", ...parts), "utf8");

/**
 * Approve and Reject must be exactly equal. In a flex row with `flex-1` the button's own padding and
 * border sat outside the flex basis, so Reject came out wider; a two-column grid gives each cell the
 * same width whatever is inside. Written, not run.
 */
describe("Approve / Reject row on the Requests card", () => {
  const card = read("app", "owner", "(app)", "requests", "_components", "pending-list.tsx");
  const reject = read("modules", "booking", "ui", "reject-sheet.tsx");

  it("is a two-column grid with a gap and a top margin", () => {
    expect(card).toContain('className="mt-3 grid grid-cols-2 gap-3"');
  });

  it("has the Approve form as a direct, shrinkable grid child with a full-width button", () => {
    expect(card).toMatch(/<form action=\{submitApproveBooking\} className="min-w-0">/);
    expect(card).toMatch(/<SubmitButton className="w-full">\s*\{ui\("owner\.approve", locale\)\}/);
  });

  it("gives the Reject trigger w-full through className and no flex-1", () => {
    expect(card).toMatch(/<RejectRequestButton[\s\S]*?className="w-full"/);
    expect(reject).toContain('cn("min-w-0", className)');
    expect(reject).not.toContain("flex-1");
  });
});
