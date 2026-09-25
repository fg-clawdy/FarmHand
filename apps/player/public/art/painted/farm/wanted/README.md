# Wanted flyers

## Template
`wanted_poster_template.png` — blank 1890s western WANTED paper. This is the only base art.

## Generated flyers
`chores/{slug}.png` — one flyer per chore with title, emoji, and reward **baked into** the paper.

## Application contract (no placeholders)
When a chore is **created or updated** (title / emoji / reward fields that appear on the flyer), the API must regenerate that chore’s flyer from the template and write `chores/{slug}.png` (or the equivalent served media path).

- Do **not** ship an “unknown chore” placeholder poster.
- Until generation finishes, the Job Board should wait/retry or keep the previous flyer for updates — never show a blank stub asset.
- Seed/backfill: run the generator once for the full `CHORE_CATALOG` (and any DB chores) on deploy/migrate.

## Generator
Port `scripts/generate-wanted-flyer` (or API module) to composite onto the template:
1. Load template
2. Draw emoji in center band (aged/desaturated slightly)
3. Draw title in slab-serif letterpress ink under the icon
4. Draw reward line near bottom (e.g. `+1 SEED`)
5. Soft noise/soak so ink sits in the paper

Player `CorkboardHotspot` loads the chore flyer texture (not hovering Text). Scale poster to nearly fill cork face.
