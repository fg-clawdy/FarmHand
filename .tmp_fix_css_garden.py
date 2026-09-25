from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\styles.css')
t = p.read_text(encoding='utf-8')
t2 = t.replace('.garden-shell .meter.seed-meter', '.meter.seed-meter')
p.write_text(t2, encoding='utf-8')
print('css updated', t != t2)
