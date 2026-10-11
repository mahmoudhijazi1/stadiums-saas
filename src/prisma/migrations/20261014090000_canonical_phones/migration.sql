-- Canonical phones (people/domain/phone.ts toCanonicalPhone; checked with isCanonicalPhone).
-- A stored phone becomes digits with the country code (Lebanon 961); people who now share one
-- canonical phone at one stadium are merged into the earliest one. Hand-written, idempotent:
-- running it twice leaves the data unchanged and does not fail. The merge is one DO block, so it
-- is atomic whatever Prisma wraps around the file. No amount, status, "during" or "tenantId"
-- changes anywhere.

-- 1. The rule for STORED values, kept permanently so the SQL and the TypeScript can be compared
--    (test/integration/canonical-phone-sql.integration.test.ts). Country is always 961.
--    Mirrors toCanonicalPhone: Arabic-Indic digits are converted; spaces, dashes, dots and
--    parentheses are ignored; a leading "+" or "00" means international.
CREATE OR REPLACE FUNCTION people_canonical_phone(p text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t text;
  d text;
  international boolean := false;
BEGIN
  IF p IS NULL THEN
    RETURN NULL;
  END IF;
  t := btrim(translate(p, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'));
  IF t !~ '^[-0-9+().[:space:]]+$' THEN
    RETURN NULL;
  END IF;
  t := regexp_replace(t, '[-().[:space:]]', '', 'g');
  IF left(t, 1) = '+' THEN
    international := true;
    d := substr(t, 2);
  ELSIF left(t, 2) = '00' THEN
    international := true;
    d := substr(t, 3);
  ELSE
    d := t;
  END IF;
  IF d !~ '^[0-9]+$' THEN
    RETURN NULL;
  END IF;
  IF international THEN
    IF left(d, 3) = '961' THEN
      d := substr(d, 4);
    ELSIF d ~ '^[1-9][0-9]{9,14}$' THEN
      RETURN d;
    ELSE
      RETURN NULL;
    END IF;
  ELSIF left(d, 3) = '961' AND length(d) IN (10, 11) THEN
    d := substr(d, 4);
  END IF;
  -- A Lebanese national number: one leading 0 dropped, then 7 digits or 8 starting with 7 or 8.
  IF left(d, 1) = '0' THEN
    d := substr(d, 2);
  END IF;
  IF d ~ '^[0-9]{7}$' OR d ~ '^[78][0-9]{7}$' THEN
    RETURN '961' || d;
  END IF;
  RETURN NULL;
END $$;

-- 2 to 7. Map, merge, re-point, rewrite.
DO $$
DECLARE
  n_groups integer := 0;
  n_removed integer := 0;
  n_person_updated integer := 0;
  n_person_unconvertible integer := 0;
  n_sale_updated integer := 0;
  n_tenant_updated integer := 0;
  n_rows integer;
  bad integer;
BEGIN
  DROP TABLE IF EXISTS _pc_people;
  DROP TABLE IF EXISTS _pc_merge;

  CREATE TEMP TABLE _pc_people ON COMMIT DROP AS
  SELECT p."id", p."tenantId", p."createdAt", people_canonical_phone(p."phone") AS canon
  FROM "Person" p
  WHERE p."phone" IS NOT NULL;

  -- Survivor of a group (same tenant, same canonical phone) = the earliest createdAt, then id.
  CREATE TEMP TABLE _pc_merge ON COMMIT DROP AS
  SELECT ranked."id" AS dup_id, ranked.survivor_id
  FROM (
    SELECT "id",
           first_value("id") OVER (PARTITION BY "tenantId", canon ORDER BY "createdAt", "id") AS survivor_id
    FROM _pc_people
    WHERE canon IS NOT NULL
  ) ranked
  WHERE ranked."id" <> ranked.survivor_id;

  SELECT COUNT(DISTINCT survivor_id) INTO n_groups FROM _pc_merge;

  -- Guards: two people of one group must not meet on the same booking.
  SELECT COUNT(*) INTO bad FROM (
    SELECT bp."bookingId", COALESCE(m.survivor_id, bp."personId") AS grp
    FROM "BookingParticipant" bp
    LEFT JOIN _pc_merge m ON m.dup_id = bp."personId"
    WHERE bp."personId" IS NOT NULL
      AND (m.dup_id IS NOT NULL OR bp."personId" IN (SELECT survivor_id FROM _pc_merge))
    GROUP BY bp."bookingId", COALESCE(m.survivor_id, bp."personId")
    HAVING COUNT(DISTINCT bp."personId") > 1
  ) q;
  IF bad > 0 THEN
    RAISE EXCEPTION 'people to merge are participants of the same booking: % booking(s)', bad;
  END IF;

  SELECT COUNT(*) INTO bad FROM (
    SELECT s."bookingId", COALESCE(m.survivor_id, s."payerPersonId") AS grp
    FROM "Sale" s
    LEFT JOIN _pc_merge m ON m.dup_id = s."payerPersonId"
    WHERE s."payerPersonId" IS NOT NULL
      AND s."bookingId" IS NOT NULL
      AND (m.dup_id IS NOT NULL OR s."payerPersonId" IN (SELECT survivor_id FROM _pc_merge))
    GROUP BY s."bookingId", COALESCE(m.survivor_id, s."payerPersonId")
    HAVING COUNT(DISTINCT s."payerPersonId") > 1
  ) q;
  IF bad > 0 THEN
    RAISE EXCEPTION 'people to merge are payers of sales on the same booking: % booking(s)', bad;
  END IF;

  -- Re-point everything that references a merged-away person to its survivor.
  UPDATE "BookingParticipant" bp SET "personId" = m.survivor_id
  FROM _pc_merge m WHERE bp."personId" = m.dup_id;

  UPDATE "Sale" s SET "payerPersonId" = m.survivor_id
  FROM _pc_merge m WHERE s."payerPersonId" = m.dup_id;

  UPDATE "SlotInterest" si SET "personId" = m.survivor_id
  FROM _pc_merge m WHERE si."personId" = m.dup_id;

  UPDATE "BookingSeries" bs SET "personId" = m.survivor_id
  FROM _pc_merge m WHERE bs."personId" = m.dup_id;

  UPDATE "UserPersonLink" l SET "personId" = m.survivor_id
  FROM _pc_merge m WHERE l."personId" = m.dup_id;

  -- A survivor may now hold the same waitlist window or the same account link twice: keep one.
  DELETE FROM "SlotInterest" a USING "SlotInterest" b
  WHERE a."tenantId" = b."tenantId" AND a."pitchId" = b."pitchId" AND a."during" = b."during"
    AND a."personId" = b."personId" AND a."id" > b."id"
    AND a."personId" IN (SELECT survivor_id FROM _pc_merge);

  DELETE FROM "UserPersonLink" a USING "UserPersonLink" b
  WHERE a."tenantId" = b."tenantId" AND a."userId" = b."userId" AND a."personId" = b."personId"
    AND a."relation" = b."relation" AND a."id" > b."id"
    AND a."personId" IN (SELECT survivor_id FROM _pc_merge);

  DELETE FROM "Person" WHERE "id" IN (SELECT dup_id FROM _pc_merge);
  GET DIAGNOSTICS n_removed = ROW_COUNT;

  -- The phone itself, where it differs. NULL (unconvertible) leaves the row unchanged.
  UPDATE "Person" p SET "phone" = c.canon
  FROM _pc_people c
  WHERE c."id" = p."id" AND c.canon IS NOT NULL AND p."phone" <> c.canon;
  GET DIAGNOSTICS n_person_updated = ROW_COUNT;

  SELECT COUNT(*) INTO n_person_unconvertible FROM _pc_people WHERE canon IS NULL;

  -- Typed shop-tab phones.
  UPDATE "Sale" SET "payerPhone" = people_canonical_phone("payerPhone")
  WHERE "payerPhone" IS NOT NULL
    AND people_canonical_phone("payerPhone") IS NOT NULL
    AND "payerPhone" <> people_canonical_phone("payerPhone");
  GET DIAGNOSTICS n_sale_updated = ROW_COUNT;

  -- The stadium's own published phones: only a Lebanese (961...) result is written back.
  UPDATE "Tenant" SET "settings" = jsonb_set("settings", '{phone}', to_jsonb(people_canonical_phone("settings"->>'phone')))
  WHERE jsonb_typeof("settings"->'phone') = 'string'
    AND people_canonical_phone("settings"->>'phone') LIKE '961%'
    AND "settings"->>'phone' <> people_canonical_phone("settings"->>'phone');
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  n_tenant_updated := n_tenant_updated + n_rows;

  UPDATE "Tenant" SET "settings" = jsonb_set("settings", '{whatsapp}', to_jsonb(people_canonical_phone("settings"->>'whatsapp')))
  WHERE jsonb_typeof("settings"->'whatsapp') = 'string'
    AND people_canonical_phone("settings"->>'whatsapp') LIKE '961%'
    AND "settings"->>'whatsapp' <> people_canonical_phone("settings"->>'whatsapp');
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  n_tenant_updated := n_tenant_updated + n_rows;

  RAISE NOTICE 'canonical phones: groups merged %, persons removed %, person phones updated %, person phones left unconvertible %, sale phones updated %, tenant phones updated %',
    n_groups, n_removed, n_person_updated, n_person_unconvertible, n_sale_updated, n_tenant_updated;
END $$;
