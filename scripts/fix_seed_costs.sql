-- Restore tiered seedCost 1/2/4/6/8/10 on live GameConfigRow without touching durationMinutes.
-- Run inside the api/db container, e.g.:
--   docker compose exec -T db psql -U farmhand -d farmhand < fix_seed_costs.sql

UPDATE "GameConfigRow"
SET data = jsonb_set(
  data,
  '{tiers}',
  (
    SELECT jsonb_agg(
      CASE (t.elem->>'tier')::int
        WHEN 1 THEN jsonb_set(t.elem, '{seedCost}', '1'::jsonb)
        WHEN 2 THEN jsonb_set(t.elem, '{seedCost}', '2'::jsonb)
        WHEN 3 THEN jsonb_set(t.elem, '{seedCost}', '4'::jsonb)
        WHEN 4 THEN jsonb_set(t.elem, '{seedCost}', '6'::jsonb)
        WHEN 5 THEN jsonb_set(t.elem, '{seedCost}', '8'::jsonb)
        WHEN 6 THEN jsonb_set(t.elem, '{seedCost}', '10'::jsonb)
        ELSE t.elem
      END
      ORDER BY (t.elem->>'tier')::int
    )
    FROM jsonb_array_elements(data->'tiers') WITH ORDINALITY AS t(elem, ord)
  )
)
WHERE id = 'default';

-- Verify:
-- SELECT elem->>'tier' AS tier, elem->>'seedCost' AS seed, elem->>'durationMinutes' AS mins
-- FROM "GameConfigRow", jsonb_array_elements(data->'tiers') AS elem WHERE id='default';
