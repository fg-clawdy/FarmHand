from pathlib import Path
REPO = Path(r'C:\Users\theha\Documents\GIT\FarmHand')
css = REPO / 'apps/player/src/styles.css'
t = css.read_text(encoding='utf-8')

if 'tier-recommended' not in t:
    old = '.picker-intro { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }'
    new = '''.picker-intro {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: #fff8e6;
  font-weight: 800;
  text-shadow:
    0 0 6px rgba(42, 22, 8, 0.95),
    0 1px 0 #3a2410,
    0 2px 0 #2a1608,
    0 -1px 0 rgba(42, 22, 8, 0.55);
  -webkit-text-stroke: 0.6px rgba(42, 22, 8, 0.55);
  paint-order: stroke fill;
}
.picker-intro .inline-art {
  filter: drop-shadow(0 1px 0 #2a1608) drop-shadow(0 0 3px rgba(255, 248, 230, 0.7));
}
.tier-recommended {
  border-color: #f0b429;
  box-shadow:
    0 6px 0 #5c3218,
    inset 0 2px 0 #fff,
    0 0 0 3px rgba(255, 229, 106, 0.55),
    0 0 18px rgba(255, 210, 80, 0.55);
  animation: tierRecommendPulse 2.4s ease-in-out infinite;
}
@keyframes tierRecommendPulse {
  0%, 100% {
    box-shadow:
      0 6px 0 #5c3218,
      inset 0 2px 0 #fff,
      0 0 0 3px rgba(255, 229, 106, 0.4),
      0 0 12px rgba(255, 210, 80, 0.35);
  }
  50% {
    box-shadow:
      0 6px 0 #5c3218,
      inset 0 2px 0 #fff,
      0 0 0 4px rgba(255, 229, 106, 0.7),
      0 0 22px rgba(255, 210, 80, 0.65);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tier-recommended { animation: none; }
}'''
    if old not in t:
        # multiline variant already?
        print('picker-intro one-liner not found; trying flexible')
        import re
        t2, n = re.subn(
            r'\.picker-intro\s*\{[^}]*\}',
            new,
            t,
            count=1,
        )
        if n == 0:
            print('FAIL picker-intro')
            raise SystemExit(1)
        t = t2
    else:
        t = t.replace(old, new, 1)
    print('added picker-intro + tier-recommended')
else:
    print('tier-recommended already present')

old_selfie = '''.garden-tool.selfie-tool {
  width: 88px;
  min-height: 112px;
}'''
new_selfie = '''.garden-tool.selfie-tool {
  /* Match Water/Seeds unselected footprint so Chores isn't a smaller button. */
  width: 108px;
  min-height: 112px;
}'''
if 'width: 88px' in t and '.garden-tool.selfie-tool' in t:
    t = t.replace(old_selfie, new_selfie, 1)
    print('selfie tool width 108')
elif 'width: 108px' in t:
    print('selfie already 108')
else:
    print('WARN selfie width pattern not found')

t = t.replace(
    '''.selfie-tool-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  font-size: 40px;
  line-height: 1;
}''',
    '''.selfie-tool-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  font-size: 42px;
  line-height: 1;
}''',
    1,
)

ticks = '''
.harvest-acorn-page,
.harvest-acorn-fill,
.harvest-acorn-ticks,
.harvest-acorn-outline {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.harvest-acorn-page { z-index: 1; }
.harvest-acorn-fill {
  z-index: 2;
  transition: clip-path 0.38s cubic-bezier(.2,.85,.25,1);
}
.harvest-acorn-ticks { z-index: 3; }
.harvest-acorn-outline { z-index: 4; }
'''
if '.harvest-acorn-ticks' not in t:
    t = t.rstrip() + '\n' + ticks + '\n'
    print('added harvest-acorn-ticks')
else:
    print('ticks css present')

css.write_text(t, encoding='utf-8')
print('styles ok')
