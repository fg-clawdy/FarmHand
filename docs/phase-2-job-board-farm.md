# Phase 2 — Main-farm Job Board (corkboard)

Product lock for the **shared family corkboard** on the main farm playfield. Garden plot / mound crop seating is unchanged (Playfield Art). Chore rules: [`phase-2-chores.md`](phase-2-chores.md).

## Corkboard hotspot

The Job Board is a **separate playfield prop**, like Farm Store — not a garden plot.

- UV hit: `PLAYFIELD_LAYOUT.jobBoardHit` (between tractor and market stand, above the cow corridor).
- Painted cork board + a **Wanted poster** for the highlighted open chore (emoji, title, **+1 waiting seed**; CRITICAL dog chores use WANTED emphasis).
- **Rotation:** cycle chores that are still open for *someone* in the family (active, period-eligible, assignment-aware). SPECIFIC chores assigned to a subset (e.g. Dishes → Willow+Finn) still show. Current poster **tears off**, next **pins up**.
- Label: **Job Board**. Tap opens the Job Coach, then the family board. **No PIN to browse.**

## Coach → claim identity

1. Tap corkboard → shared **Job Coach** (“Do a job to plant a waiting seed”). Empty-pouch / low-seed garden nudges reuse this modal.
2. Continue → family Job Board (same cards as garden, no per-kid mute yet).
3. Tap a job to **claim**:
   - If a PIN garden session is already active → use that kid.
   - Else → **Whose job?** (Willow / Finn / Sage) then PIN if that kid has a PIN (`POST /api/players/:id/enter`). No second password.
4. After identity, the board filters to chores **that kid** can claim. Ineligible SPECIFIC jobs show the existing reason (`That chore isn't assigned to you.`). The waiting seed is planted only in **their** garden.

`GET /api/farm/jobs` is unauthenticated. `GET /api/chores` and `POST /api/chores/:id/claim` still require the player session.

## Verify

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Manual: main farm corkboard Wanted rotation → tap → coach → Whose job? / PIN → claim. Garden mounds must not move.
