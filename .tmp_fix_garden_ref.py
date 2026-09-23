from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx')
t = p.read_text(encoding='utf-8')
t = t.replace(
    'const seedMeterRef = useRef<HTMLDivElement>(null);\n  const [seedMeterEl, setSeedMeterEl] = useState<HTMLDivElement | null>(null);',
    'const [seedMeterEl, setSeedMeterEl] = useState<HTMLDivElement | null>(null);',
)
t = t.replace(
    'ref={(el) => { seedMeterRef.current = el; setSeedMeterEl(el); }}',
    'ref={setSeedMeterEl}',
)
# remove unused useRef if no longer needed elsewhere
if 'useRef' in t and t.count('useRef') == 1:
    t = t.replace(', useRef', '')
p.write_text(t, encoding='utf-8')
print('garden ref fixed', 'seedMeterRef' in t)
