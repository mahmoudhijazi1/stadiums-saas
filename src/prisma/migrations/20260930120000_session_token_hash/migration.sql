-- Security audit S-2. The cookie now carries a 256-bit random token and the
-- row stores only its SHA-256. Old sessions used the row id as the cookie and
-- have no hash, so they are all dropped: every user logs in again.

DELETE FROM "Session";

ALTER TABLE "Session" ADD COLUMN "tokenHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
