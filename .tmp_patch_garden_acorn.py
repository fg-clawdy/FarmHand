from pathlib import Path

garden = Path(r"C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\screens\Garden.tsx")
text = garden.read_text(encoding="utf-8")

if "HarvestAcornCelebration" not in text:
    text = text.replace(
        'import HarvestCelebration from "../components/HarvestCelebration";',
        'import HarvestCelebration from "../components/HarvestCelebration";\nimport HarvestAcornCelebration from "../components/HarvestAcornCelebration";',
        1,
    )

# Add seedMeterRef near other hooks - after gain state
if "seedMeterRef" not in text:
    text = text.replace(
        "  const [gain, setGain] = useState<HarvestReward | null>(null);",
        """  const [gain, setGain] = useState<HarvestReward | null>(null);
  const [acornFx, setAcornFx] = useState<null | {
    reward: HarvestReward;
    shardsBefore: number;
    seedsBefore: number;
  }>(null);
  const seedMeterRef = useRef<HTMLDivElement>(null);""",
        1,
    )

# Ensure useRef imported
if "useRef" not in text.split("from \"react\"")[0]:
    text = text.replace("useState", "useState, useRef", 1)
    # might double - check
    if "useState, useRef, useRef" in text:
        text = text.replace("useState, useRef, useRef", "useState, useRef", 1)
    if "useEffect, useState, useRef" not in text and "useState, useRef" in text:
        pass

# Fix import line more carefully
import re
m = re.search(r'import \{([^}]+)\} from "react"', text)
if m and "useRef" not in m.group(1):
    text = text[: m.start(1)] + m.group(1).rstrip() + ", useRef" + text[m.end(1) :]

# Harvest handler - capture before values
old = """        const data = await api.harvest(slot);
        sceneRef.current?.fxHarvest(slot, data.reward);
        setGain(data.reward);
        noteUnlocks(data.unlocks);
        setOverlay(null);
        window.setTimeout(() => setGain((cur) => (cur === data.reward ? null : cur)), 4200);
        return data.player;"""

new = """        const shardsBefore = player.seedShards;
        const seedsBefore = player.seeds + player.provisionalSeeds;
        const data = await api.harvest(slot);
        sceneRef.current?.fxHarvest(slot, data.reward);
        setGain(data.reward);
        if ((data.reward.shardsEarned ?? 0) > 0) {
          setAcornFx({ reward: data.reward, shardsBefore, seedsBefore });
        }
        noteUnlocks(data.unlocks);
        setOverlay(null);
        window.setTimeout(() => setGain((cur) => (cur === data.reward ? null : cur)), 5200);
        return data.player;"""

if old not in text:
    raise SystemExit("harvest block not found")
text = text.replace(old, new, 1)

# Seed meter markup
old_meter = """          <div className={`meter ${gain && gain.seedsFromShards > 0 ? "bump" : ""}`}>
            <AcornArt /> {player.seeds + player.provisionalSeeds}
            {gain && gain.seedsFromShards > 0 && <span className="meter-delta">+{gain.seedsFromShards}</span>}
          </div>"""
new_meter = """          <div
            ref={seedMeterRef}
            className={`meter seed-meter ${gain && gain.seedsFromShards > 0 ? "bump" : ""}`}
          >
            <AcornArt />{" "}
            <span className="seed-count">{acornFx ? acornFx.seedsBefore : player.seeds + player.provisionalSeeds}</span>
            {gain && gain.seedsFromShards > 0 && !acornFx && (
              <span className="meter-delta">+{gain.seedsFromShards}</span>
            )}
          </div>"""
if old_meter not in text:
    raise SystemExit("seed meter block not found")
text = text.replace(old_meter, new_meter, 1)

# Hide diamond shard meter bump during acorn fx optional - leave as is for now

# Render acorn celebration
old_gain = "{gain && <HarvestCelebration reward={gain} config={config} />}"
new_gain = """{gain && <HarvestCelebration reward={gain} config={config} />}
      {acornFx && (
        <HarvestAcornCelebration
          reward={acornFx.reward}
          config={config}
          shardsBefore={acornFx.shardsBefore}
          seedsBefore={acornFx.seedsBefore}
          seedMeterEl={seedMeterRef.current}
          onFinished={() => setAcornFx(null)}
        />
      )}"""
if old_gain not in text:
    raise SystemExit("HarvestCelebration render not found")
text = text.replace(old_gain, new_gain, 1)

garden.write_text(text, encoding="utf-8")
print("Garden.tsx patched")

# Append CSS if missing
css = Path(r"C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\styles.css")
ct = css.read_text(encoding="utf-8")
extra = Path(r"C:\Users\theha\Documents\GIT\FarmHand\.tmp_acorn_harvest.css").read_text(encoding="utf-8")
if "harvest-acorn-stage" not in ct:
    css.write_text(ct.rstrip() + "\n" + extra + "\n", encoding="utf-8")
    print("styles.css appended")
else:
    print("styles already have acorn")
