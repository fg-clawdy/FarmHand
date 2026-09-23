from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx')
lines = p.read_text(encoding='utf-8').splitlines()
print('TOTAL', len(lines))
for i, line in enumerate(lines, 1):
    if any(k in line for k in ('HarvestCelebration', 'harvest', 'gain', 'seedShards', 'shardsPerSeed', 'setGain', 'reward', 'meter')):
        print(f'{i}:{line}')
