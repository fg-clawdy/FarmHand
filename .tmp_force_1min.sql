UPDATE "GameConfigRow"
SET data = jsonb_set(
  jsonb_set(
    data,
    '{startingSeeds}',
    '20'::jsonb
  ),
  '{tiers}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem ? 'durationMinutes' THEN jsonb_set(elem, '{durationMinutes}', '1'::jsonb)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(data->'tiers') AS elem
  )
)
WHERE id = 'default';

SELECT data->'tiers'->0->>'durationMinutes' AS t1_min,
       data->'tiers'->2->>'durationMinutes' AS t3_min,
       data->>'startingSeeds' AS starting
FROM "GameConfigRow" WHERE id = 'default';
