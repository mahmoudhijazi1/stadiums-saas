-- Tenant management (platform operator CLI). Additive only: safe while the old
-- code runs (it never reads or writes these columns or tables).

ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspendedReason" TEXT;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "paidUntil" TIMESTAMP(3),
    "amountUsd" DECIMAL(12,2),
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tenantId" TEXT,
    "actor" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_tenantId_createdAt_idx" ON "Subscription"("tenantId", "createdAt");
CREATE INDEX "PlatformAuditLog_tenantId_createdAt_idx" ON "PlatformAuditLog"("tenantId", "createdAt");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only (decision 8). Row triggers: TRUNCATE (test helper, seed) is not blocked.
CREATE FUNCTION platform_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % refused', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER "PlatformAuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "PlatformAuditLog"
  FOR EACH ROW EXECUTE FUNCTION platform_append_only();

CREATE TRIGGER "Subscription_append_only"
  BEFORE UPDATE OR DELETE ON "Subscription"
  FOR EACH ROW EXECUTE FUNCTION platform_append_only();
