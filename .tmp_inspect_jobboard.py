from pathlib import Path
root = Path(r'C:\Users\theha\Documents\GIT\FarmHand')
t = (root / 'apps/player/src/pixi/jobBoard.ts').read_text(encoding='utf-8')
for i, line in enumerate(t.splitlines(), 1):
    if any(k in line for k in ('rotation', 'skew', 'scale', 'rest', 'poster', 'FLYER', 'SHEET', 'poseScale', 'resetPoster')):
        print(f'{i}:{line}')
print('---LEN', len(t.splitlines()))
# painted assets cork hang
pa = (root / 'apps/player/src/pixi/paintedAssets.ts').read_text(encoding='utf-8')
for i, line in enumerate(pa.splitlines(), 1):
    if 'CORKBOARD' in line or 'WANTED' in line:
        print(f'pa{i}:{line}')
