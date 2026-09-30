import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { checkEnvAtStartup, validateEnv } from "@/lib/env";

/** Startup env validation: fail fast in production, name variables, never print values. */
const valid = {
  DATABASE_URL: "postgresql://user:s3cret@db.internal:5432/stadiums?schema=public",
  APP_BASE_DOMAIN: "lebstads.com",
  APP_PROTOCOL: "https",
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("validateEnv", () => {
  it("accepts the required set, with or without the optional settings", () => {
    expect(validateEnv(valid)).toEqual([]);
    expect(
      validateEnv({
        ...valid,
        APP_BASE_DOMAIN: "localhost:3000",
        APP_PROTOCOL: "http",
        PASSWORD_HASH_COST: "15",
        TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
        TRUST_PROXY_HEADERS: "true",
        PG_POOL_MAX: "10",
      }),
    ).toEqual([]);
  });

  it("names each missing required variable", () => {
    expect(validateEnv({})).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL"),
        expect.stringContaining("APP_BASE_DOMAIN"),
        expect.stringContaining("APP_PROTOCOL"),
      ]),
    );
  });

  it("rejects malformed values", () => {
    const bad = {
      DATABASE_URL: "mysql://x",
      APP_BASE_DOMAIN: "https://lebstads.com/",
      APP_PROTOCOL: "ftp",
      PASSWORD_HASH_COST: "30",
      TRUSTED_CLIENT_IP_HEADER: "x real ip",
      TRUST_PROXY_HEADERS: "yes",
      PG_POOL_MAX: "0",
    };
    const errors = validateEnv(bad).join("\n");
    for (const name of Object.keys(bad)) expect(errors).toContain(name);
  });

  it("never prints a value (DATABASE_URL holds a password)", () => {
    const errors = validateEnv({ ...valid, APP_PROTOCOL: "ftp", DATABASE_URL: "s3cret-not-a-url" }).join("\n");
    expect(errors).not.toContain("s3cret");
    expect(errors).not.toContain("ftp");
  });
});

describe("checkEnvAtStartup", () => {
  it("throws in production when invalid", () => {
    expect(() => checkEnvAtStartup({ NODE_ENV: "production" })).toThrow(/APP_BASE_DOMAIN/);
  });

  it("passes in production when valid", () => {
    expect(() => checkEnvAtStartup({ ...valid, NODE_ENV: "production" })).not.toThrow();
  });

  it("only warns outside production", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => checkEnvAtStartup({ NODE_ENV: "development" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
