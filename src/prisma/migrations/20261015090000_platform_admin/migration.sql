-- DR-006 slice 2: the web platform admin's identity and sessions. Additive: two new global tables,
-- nothing existing is touched. No tenantId; the tenant-scoped client refuses both
-- (PLATFORM_ONLY_MODELS). Hand-written; the CHECK is SQL-only.

CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "lastTotpStep" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlatformAdmin_identifier_lowercase" CHECK ("identifier" = lower("identifier"))
);

CREATE UNIQUE INDEX "PlatformAdmin_identifier_key" ON "PlatformAdmin"("identifier");

CREATE TABLE "PlatformSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformSession_tokenHash_key" ON "PlatformSession"("tokenHash");

CREATE INDEX "PlatformSession_adminId_idx" ON "PlatformSession"("adminId");

ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "PlatformAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
