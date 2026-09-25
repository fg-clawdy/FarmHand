from pathlib import Path
import re
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\packages\shared\src\config.ts')
t = p.read_text(encoding='utf-8')
# Fix: // TEST ate rest of object lines — use block comments
t2 = t.replace('durationMinutes: 1, // TEST', 'durationMinutes: 1, /* TEST */')
t2 = t2.replace('export const FLAT_TIER_DURATION_MINUTES = 1; // TEST: was 24*60', 'export const FLAT_TIER_DURATION_MINUTES = 1; /* TEST: was 24*60 */')
t2 = t2.replace('startingSeeds: 20, // TEST', 'startingSeeds: 20, /* TEST */')
p.write_text(t2, encoding='utf-8')
# Show lines 1-45
for i, line in enumerate(t2.splitlines()[:45], 1):
    print(f'{i}:{line}')
