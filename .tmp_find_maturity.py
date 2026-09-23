from pathlib import Path
root = Path(r'C:\Users\theha\Documents\GIT\FarmHand')
keys = ('mature', 'duration', 'growMs', 'growthMs', 'hours', 'minutes', 'tier', 'seedCost', 'startingSeeds')
for rel in [
    'packages/shared/src/config.ts',
    'packages/shared/src/types.ts',
    'apps/api/src/game.ts',
]:
    p = root / rel
    print('====', rel)
    for i, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
        low = line.lower()
        if any(k.lower() in low for k in keys):
            if 'shard' in low and 'mature' not in low and 'duration' not in low and 'start' not in low and 'tier' not in low:
                continue
            print(f'{i}:{line}')
