# FarmHand Job Board UX drop-in

## Product changes
1. Farm Job Board stake tap → chore modal for the **currently displayed** Wanted flyer chore (fallback: full FarmJobFlow only if no flyer job).
2. That Farm modal: one `{Name} Claims` button per child + Close. Claim = enter/PIN that kid (existing APIs) then `POST /api/chores/:id/claim` if eligible.
3. Garden Job Board **cards**: restore emoji+title cards — **no Wanted flyer images**. Farm corkboard flyer pipeline untouched.

## Files
| Path | Change |
|------|--------|
| `apps/player/src/pixi/jobBoard.ts` | ADD `getCurrentJob()` only |
| `apps/player/src/pixi/FarmScene.ts` | ADD `getCurrentWantedJob()` only |
| `apps/player/src/screens/FarmDashboard.tsx` | Wire stake tap → FarmChoreClaim |
| `apps/player/src/components/FarmChoreClaim.tsx` | NEW — N+1 claim buttons |
| `apps/player/src/components/JobBoard.tsx` | Remove flyer `<img>` from JobCard |

## Apply on Windows (machineId a43cce9d-…)
1. Copy this `dropin/` folder onto the box uploads or the Windows tree.
2. From FarmHand repo root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File APPLY.ps1 "C:\Users\theha\Documents\GIT\FarmHand" "<path-to-dropin>"
   ```
3. User rebuilds: `docker compose up -d --build` (player image).

## Claim-from-Farm flow
`{Name} Claims` → `api.session` / `api.enter(id, pin?)` → `api.chores()` eligibility check → `api.claimChore` (or selfie capture) → toast + close.
