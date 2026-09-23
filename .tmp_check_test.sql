SELECT name, seeds FROM "Player";
SELECT data->'tiers'->0->>'durationMinutes' AS t1_min, data->'tiers'->2->>'durationMinutes' AS t3_min, data->>'startingSeeds' AS starting FROM "GameConfigRow" WHERE id = 'default';
