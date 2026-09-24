-- UX-02 slice 1 / D10. Day reads filter tenant + lower(during).
-- Expression index. Prisma cannot declare lower(during). Exclusion constraint untouched.

CREATE INDEX "Booking_tenantId_lower_during_idx"
  ON "Booking" ("tenantId", lower(during));
