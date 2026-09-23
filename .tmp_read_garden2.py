from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx')
lines = p.read_text(encoding='utf-8').splitlines()
for start, end in [(220, 290), (330, 370), (510, 535)]:
    print(f'==== {start}-{end} ====')
    for i in range(start, min(end, len(lines))+1):
        print(f'{i}:{lines[i-1]}')
