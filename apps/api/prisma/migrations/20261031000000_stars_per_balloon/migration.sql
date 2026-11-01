-- Default stars that fill one meadow balloon. Existing configs keep every
-- other knob and gain this key. The API also fills it in when the key is missing.
UPDATE "GameConfigRow"
SET "data" = jsonb_set("data"::jsonb, '{starsPerBalloon}', '200'::jsonb, true)
WHERE NOT (("data"::jsonb) ? 'starsPerBalloon');
