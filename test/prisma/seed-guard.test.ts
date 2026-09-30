import { describe, expect, it } from "@jest/globals";
import { assertSeedAllowed } from "@/prisma/seed-guard";

/**
 * Security audit S-1: the seed wipes every table and recreates users with a
 * known password, so it must refuse production and any database that is not
 * the local dev or test one.
 */
const url = (name: string) =>
  `postgresql://stadiums_local:stadiums_local_dev@localhost:5433/${name}?schema=public`;

describe("assertSeedAllowed", () => {
  it("allows the local dev and test databases outside production", () => {
    expect(() => assertSeedAllowed({ nodeEnv: "development", databaseUrl: url("stadiums_dev") })).not.toThrow();
    expect(() => assertSeedAllowed({ nodeEnv: "test", databaseUrl: url("stadiums_test") })).not.toThrow();
    expect(() => assertSeedAllowed({ nodeEnv: undefined, databaseUrl: url("stadiums_dev") })).not.toThrow();
  });

  it("refuses when NODE_ENV is production, even on the dev database", () => {
    expect(() => assertSeedAllowed({ nodeEnv: "production", databaseUrl: url("stadiums_dev") })).toThrow(
      /production/,
    );
  });

  it("refuses any other database name", () => {
    for (const name of ["stadiums", "stadiums_prod", "postgres", "stadiums_dev_copy", "xstadiums_test"]) {
      expect(() => assertSeedAllowed({ nodeEnv: "development", databaseUrl: url(name) })).toThrow(/stadiums_dev/);
    }
  });

  it("refuses a missing or unparsable DATABASE_URL", () => {
    expect(() => assertSeedAllowed({ nodeEnv: "development", databaseUrl: undefined })).toThrow();
    expect(() => assertSeedAllowed({ nodeEnv: "development", databaseUrl: "not a url" })).toThrow();
    expect(() =>
      assertSeedAllowed({ nodeEnv: "development", databaseUrl: "postgresql://u:p@localhost:5433/" }),
    ).toThrow();
  });
});
