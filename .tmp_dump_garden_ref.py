from pathlib import Path
lines = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx').read_text(encoding='utf-8').splitlines()
for i in range(225, 245):
    print(f'{i+1}:{lines[i]}')
print('---')
for i in range(350, 370):
    print(f'{i+1}:{lines[i]}')
