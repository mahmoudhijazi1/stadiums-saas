import { readFileSync } from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { PLATFORM_ONLY_MODELS, TENANT_SCOPED_MODELS } from "@/lib/db";

/**
 * Every model with a tenantId is classified: tenant-scoped (the extension
 * filters it) or platform-only (the scoped client refuses it). A new model
 * with tenantId and no classification fails here.
 */
function modelsWithTenantId(): string[] {
  const schema = readFileSync("src/prisma/schema.prisma", "utf8");
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
  return models.filter(([, , body]) => /^\s+tenantId\s+String/m.test(body!)).map(([, name]) => name!);
}

describe("model classification", () => {
  it("every tenantId model is tenant-scoped or platform-only, never both", () => {
    for (const model of modelsWithTenantId()) {
      const scoped = TENANT_SCOPED_MODELS.has(model);
      const platform = PLATFORM_ONLY_MODELS.has(model);
      expect([model, scoped !== platform]).toEqual([model, true]);
    }
  });

  it("Subscription and PlatformAuditLog are platform-only", () => {
    expect(PLATFORM_ONLY_MODELS.has("Subscription")).toBe(true);
    expect(PLATFORM_ONLY_MODELS.has("PlatformAuditLog")).toBe(true);
  });
});
