from pathlib import Path
import re
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\packages\shared\src\config.ts')
t = p.read_text(encoding='utf-8')
# Temporary test knobs
t2 = t.replace('export const FLAT_TIER_DURATION_MINUTES = 24 * 60;', 'export const FLAT_TIER_DURATION_MINUTES = 1; // TEST: was 24*60')
# Replace durationMinutes: 24 * 60 in DEFAULT tiers (all of them)
t2 = re.sub(r'durationMinutes: 24 \* 60,', 'durationMinutes: 1, // TEST', t2)
# startingSeeds
t2 = t2.replace('startingSeeds: 10,', 'startingSeeds: 20, // TEST')
if t2 == t:
    raise SystemExit('no changes applied to config')
p.write_text(t2, encoding='utf-8')
print('config.ts test knobs applied')
print('FLAT', 'FLAT_TIER_DURATION_MINUTES = 1' in t2)
print('start', 'startingSeeds: 20' in t2)
print('dur1 count', t2.count('durationMinutes: 1'))
