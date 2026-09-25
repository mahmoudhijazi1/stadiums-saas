-- UX-02 slice 2. searchName is normalizeName, applied here in SQL (not a script)
-- so deploy and backfill are one step. Mirrors src/modules/people/domain/normalize-name.ts:
-- trim, strip tashkeel U+064B–U+0652 and U+0670 and tatweel U+0640,
-- أ إ آ → ا, ى → ي, ة → ه, lower, collapse spaces.

ALTER TABLE "Person" ADD COLUMN "searchName" TEXT;

UPDATE "Person"
SET "searchName" = btrim(
  regexp_replace(
    lower(
      translate(
        regexp_replace(
          btrim("name"),
          U&'[\064B-\0652\0670\0640]',
          '',
          'g'
        ),
        'أإآىة',
        'ااايه'
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  )
);

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "Person"
  WHERE "searchName" IS NULL OR "searchName" = '';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'persons with empty searchName: %', bad_count;
  END IF;
END $$;

ALTER TABLE "Person" ALTER COLUMN "searchName" SET NOT NULL;

CREATE INDEX "Person_tenantId_searchName_idx"
  ON "Person" ("tenantId", "searchName");
