import { describe, expect, it } from "@jest/globals";
import { acquireRunLock, releaseRunLock, RUN_LOCK_KEY, RUN_LOCK_TAKEN_MESSAGE } from "./run-lock";

/** One integration run at a time: a second lock attempt fails while the first is held. */
const url = process.env.DATABASE_URL as string;
// Its own key, so the test does not depend on the lock this run already holds.
const TEST_KEY = 72_610_499;

describe("integration run lock", () => {
  it("refuses a second run while the first holds the lock, and allows it once released", async () => {
    const first = await acquireRunLock(url, TEST_KEY);
    try {
      await expect(acquireRunLock(url, TEST_KEY)).rejects.toThrow(RUN_LOCK_TAKEN_MESSAGE);
    } finally {
      await releaseRunLock(first, TEST_KEY);
    }
    await releaseRunLock(await acquireRunLock(url, TEST_KEY), TEST_KEY);
  });

  it("this run holds the real lock, so another run would fail at once", async () => {
    await expect(acquireRunLock(url, RUN_LOCK_KEY)).rejects.toThrow(
      "Another integration run is using stadiums_test. Wait for it to finish.",
    );
  });
});
