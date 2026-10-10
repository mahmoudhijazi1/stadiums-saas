import { describe, expect, it } from "@jest/globals";
import {
  PENDING_INBOX_MISSED_MAX,
  PENDING_INBOX_UPCOMING_MAX,
  hiddenInboxCount,
} from "@/modules/booking/domain/pending-inbox";
import { uiCount } from "@/lib/ui-copy";

/** Written, not run when authored. Hardening 2 item 5. */
describe("hiddenInboxCount", () => {
  it("is 0 at and below the caps", () => {
    expect(hiddenInboxCount({ upcoming: 0, missed: 0 })).toBe(0);
    expect(hiddenInboxCount({ upcoming: PENDING_INBOX_UPCOMING_MAX, missed: PENDING_INBOX_MISSED_MAX })).toBe(0);
  });

  it("counts one request over the upcoming cap, or over the missed cap", () => {
    expect(hiddenInboxCount({ upcoming: PENDING_INBOX_UPCOMING_MAX + 1, missed: 0 })).toBe(1);
    expect(hiddenInboxCount({ upcoming: 0, missed: PENDING_INBOX_MISSED_MAX + 1 })).toBe(1);
  });

  it("adds both lists' overflow and uses the real totals", () => {
    expect(hiddenInboxCount({ upcoming: 250, missed: 80 })).toBe(50 + 30);
  });
});

describe("the hidden-requests line", () => {
  it("carries the real number in both languages", () => {
    expect(uiCount("owner.requestsHidden", 80, "en")).toContain("80");
    expect(uiCount("owner.requestsHidden", 1, "en")).toContain("1 more request is");
    expect(uiCount("owner.requestsHidden", 80, "ar")).toContain("80");
  });
});
