from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\packages\shared\src\config.ts')
t = p.read_text(encoding='utf-8')
# Ensure block comments
if '// TEST' in t:
    t = t.replace('durationMinutes: 1, // TEST', 'durationMinutes: 1, /* TEST */')
    t = t.replace('export const FLAT_TIER_DURATION_MINUTES = 1; // TEST: was 24*60', 'export const FLAT_TIER_DURATION_MINUTES = 1; /* TEST: was 24*60 */')
    t = t.replace('startingSeeds: 20, // TEST', 'startingSeeds: 20, /* TEST */')
    p.write_text(t, encoding='utf-8')
    t = p.read_text(encoding='utf-8')
print('dur1', t.count('durationMinutes: 1'))
print('broken_line_comments', t.count('// TEST'))
print('block', t.count('/* TEST'))
print('seeds20', 'startingSeeds: 20' in t)
# Check legacy object lines still have points
for i, line in enumerate(t.splitlines(), 1):
    if 'LEGACY_TIER_ECONOMY' in line or (i >= 17 and i <= 22):
        print(f'{i}:{line}')
