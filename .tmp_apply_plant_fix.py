"""Surgical patches for a FarmHand checkout. Run from repo root: python apply_patches.py"""
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parent
# If run inside a copied folder under repo, allow override
REPO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

def patch_file(rel, fn):
    path = REPO / rel
    if not path.exists():
        print('MISSING', rel)
        return False
    old = path.read_text(encoding='utf-8')
    new = fn(old)
    if new is None:
        print('SKIP/FAIL', rel)
        return False
    if new == old:
        print('NOCHANGE', rel)
        return True
    path.write_text(new, encoding='utf-8')
    print('PATCHED', rel)
    return True

def plant_picker(text):
    text2 = text.replace(
        'Bigger plants take longer and earn more stars.',
        'Bigger plants cost more seeds and earn more stars.',
    )
    if 'tier-recommended' in text2:
        return text2
    # inject recommended logic before return (
    needle = '  const broke = !free && totalSeeds < cheapestSeedCost(config.tiers);'
    if needle not in text2:
        needle = '  const broke = !free && seeds < cheapestSeedCost(config.tiers);'
        # older signature
    insert = '''  const broke = !free && totalSeeds < cheapestSeedCost(config.tiers);
  const affordableTiers = config.tiers.filter((tier) => free || totalSeeds >= tier.seedCost);
  const recommendedTier =
    affordableTiers.length === 0
      ? null
      : affordableTiers.reduce((best, tier) =>
          tier.seedCost > best.seedCost || (tier.seedCost === best.seedCost && tier.tier > best.tier)
            ? tier
            : best,
        ).tier;'''
    # Handle both totalSeeds and seeds variants
    if 'const totalSeeds' in text2:
        text2 = text2.replace(
            '  const broke = !free && totalSeeds < cheapestSeedCost(config.tiers);',
            insert,
            1,
        )
        text2 = text2.replace(
            'className={`tier ${affordable ? "" : "disabled"}`}',
            'className={`tier ${affordable ? "" : "disabled"}${recommended ? " tier-recommended" : ""}`}',
            1,
        )
        if 'const kind = tier.kind' in text2 and 'const recommended' not in text2:
            text2 = text2.replace(
                'const kind = tier.kind ?? cropKindForTier(tier.tier);',
                'const kind = tier.kind ?? cropKindForTier(tier.tier);\n          const recommended = affordable && tier.tier === recommendedTier;',
                1,
            )
    return text2

def illustrations(text):
    text = re.sub(
        r'/\*\* Placeholders — art not yet painted\. Reuse corn sheet\. \*/\s*'
        r'tomato: "/art/painted/plants/plant_corn_stages\.png\?v=3blossom",\s*'
        r'pumpkin: "/art/painted/plants/plant_corn_stages\.png\?v=3blossom",\s*'
        r'sunflower: "/art/painted/plants/plant_corn_stages\.png\?v=3blossom",',
        'tomato: "/art/painted/plants/plant_tomato_stages.png?v=1",\n'
        '  pumpkin: "/art/painted/plants/plant_pumpkin_stages.png?v=1",\n'
        '  sunflower: "/art/painted/plants/plant_sunflower_stages.png?v=1",',
        text,
        count=1,
    )
    # also plain replace if comment already gone
    text = text.replace(
        'tomato: "/art/painted/plants/plant_corn_stages.png?v=3blossom"',
        'tomato: "/art/painted/plants/plant_tomato_stages.png?v=1"',
    )
    return text

def config(text):
    if 'isFlatSeedCostTable' not in text:
        text = text.replace(
            'export const DEFAULT_GAME_CONFIG',
            '''/** True when every stored tier still has the old flat seedCost=1 lock. */
export function isFlatSeedCostTable(
  tiers: Array<{ seedCost?: number }> | undefined,
): boolean {
  if (!tiers?.length) return false;
  return tiers.every((tier) => Number(tier.seedCost) === FLAT_TIER_SEED_COST);
}

export const DEFAULT_GAME_CONFIG''',
            1,
        )
    if 'const flatSeeds = isFlatSeedCostTable' in text:
        return text
    old = '''        return { ...tier, ...match, kind: match.kind ?? tier.kind, stages: match.stages ?? tier.stages, faces: match.faces ?? tier.faces };'''
    new = '''        const merged = {
          ...tier,
          ...match,
          kind: match.kind ?? tier.kind,
          stages: match.stages ?? tier.stages,
          faces: match.faces ?? tier.faces,
        };
        // Flat economy locked every crop to 1 seed; restore the tiered seed ladder
        // while keeping whatever durationMinutes the live DB currently has (e.g. TEST=1).
        if (flatSeeds) {
          merged.seedCost = tier.seedCost;
        }
        return merged;'''
    if old not in text:
        print('config merge return not found')
        return None
    text = text.replace(old, new, 1)
    text = text.replace(
        '  const tiers = incomingTiers',
        '  const flatSeeds = isFlatSeedCostTable(incomingTiers);\n  const tiers = incomingTiers',
        1,
    )
    # also legacy flatten path
    text = text.replace(
        'seedCost: flatten ? tier.seedCost : (match.seedCost ?? tier.seedCost),',
        'seedCost: flatten || flatSeeds ? tier.seedCost : (match.seedCost ?? tier.seedCost),',
        1,
    )
    return text

def styles(text):
    if 'tier-recommended' not in text:
        text = text.replace(
            '.picker-intro { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
            '''.picker-intro {
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
}''',
            1,
        )
    text = text.replace(
        '''.garden-tool.selfie-tool {
  width: 88px;
  min-height: 112px;
}''',
        '''.garden-tool.selfie-tool {
  /* Match Water/Seeds unselected footprint so Chores isn't a smaller button. */
  width: 108px;
  min-height: 112px;
}''',
        1,
    )
    text = text.replace(
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
    acorn = (ROOT / 'acorn_ticks_snippet.css').read_text(encoding='utf-8')
    if '.harvest-acorn-ticks' not in text:
        text = text.rstrip() + '\n\n' + acorn.lstrip() + '\n'
    elif 'z-index: 3' not in text.split('.harvest-acorn-ticks', 1)[1][:80]:
        # ensure ticks rule exists with correct z-index — leave existing if OK
        pass
    return text

# copy acorn snippet next to script
(ROOT / 'acorn_ticks_snippet.css').write_text(Path('/workspace/fh-patch/ready/acorn_coloring.css').read_text(encoding='utf-8'), encoding='utf-8')

ok = True
ok &= patch_file('apps/player/src/components/PlantPicker.tsx', plant_picker)
ok &= patch_file('apps/player/src/illustrations.tsx', illustrations)
ok &= patch_file('packages/shared/src/config.ts', config)
ok &= patch_file('apps/player/src/styles.css', styles)
# Also drop full replacements if present beside script
print('done', ok)
sys.exit(0 if ok else 1)
