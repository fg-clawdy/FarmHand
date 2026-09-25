from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx')
t = p.read_text(encoding='utf-8')
# Fix seedMeterEl={seedMeterRef.current} which is stale null on mount — pass ref via state
old = 'seedMeterEl={seedMeterRef.current}'
if 'seedMeterElState' not in t and old in t:
    if 'const [seedMeterEl, setSeedMeterEl]' not in t:
        t = t.replace(
            'const seedMeterRef = useRef<HTMLDivElement>(null);',
            'const seedMeterRef = useRef<HTMLDivElement>(null);\n  const [seedMeterEl, setSeedMeterEl] = useState<HTMLDivElement | null>(null);',
            1,
        )
    t = t.replace(old, 'seedMeterEl={seedMeterEl}', 1)
    # Add callback ref or useEffect — use callback ref on the meter div
    t = t.replace(
        'ref={seedMeterRef}',
        'ref={(el) => { seedMeterRef.current = el; setSeedMeterEl(el); }}',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('fixed seed meter el state')
else:
    print('skip or already fixed', old in t)
