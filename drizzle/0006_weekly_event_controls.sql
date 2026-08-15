UPDATE "events"
SET "event_key" = 'sat-' || to_char("starts_at" AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
WHERE "event_key" = 'next-saturday'
  AND NOT EXISTS (
    SELECT 1
    FROM "events" AS dated
    WHERE dated."event_key" = 'sat-' || to_char("events"."starts_at" AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
  );
