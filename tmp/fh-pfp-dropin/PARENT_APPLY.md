# Parent: apply FarmHand kid PFP drop-in (box-scoped — no machineId here)

## What this is
Option 1 claim UX + kid profile pictures:

1. **Presets** — sun / seedling / star / rainbow / tractor / dog (SVG under `apps/player/public/avatars/`)
2. **Selfie PFP** — reuses `SelfieCapture`; `POST /api/avatar` saves JPEG under `SELFIE_DROP_DIR/avatars/` — **no** watering unlock, **no** seed grant
3. **Profile** — big **Change picture** opens `AvatarPicker`
4. **Farm claim** — large kid tiles with `KidAvatar` (not green text buttons)
5. **Garden sign badge** — circular PFP **pinned top-left** on the existing three-plank sign; plank Name / seeds / points text **unchanged**. Badge tap → AvatarPicker (farm + garden zoom)

## Schema (`Player`)
```
avatarKind         String   @default("mascot")  // mascot | preset | selfie
avatarPreset       String?
avatarSelfieFile   String?
```
Migration: `apps/api/prisma/migrations/20260922210000_player_avatar/`

## API
- `avatarPublicUrl` / `avatarFieldsPublic` on `publicPlayer` + `/api/farm` cards + profile
- `POST /api/avatar` `{ kind:"mascot" }` | `{ kind:"preset", presetId }` | `{ kind:"selfie", image }`
- `GET /api/profile/avatar-selfie/:file` (own file only)
- `GET /api/avatar/presets`
- `/api/selfie` watering path untouched

## Player UI / Pixi
- `KidAvatar`, `AvatarPicker`, updated `ProfileSheet`, tile `FarmChoreClaim`
- `signAvatar.ts` → `SignAvatarBadge` overlay on `FarmScene` / `GardenScene` (hit-target stops propagation so garden open still uses the rest of the sign)
- Overlays: Garden `avatar-picker`; FarmDashboard avatar after enter/PIN

## Apply (parent agent — Windows machine)

```text
1) ListMachines → confirm family machine connected
2) CopyFromBox:
     box_path: /workspace/fh-pfp/farmhand-pfp-dropin.tgz
     machineId: <family-machine-id>
     computer_path: C:\Users\theha\Documents\GIT\FarmHand\tmp\farmhand-pfp-dropin.tgz
3) Shell (machineId=…):

Set-Location C:\Users\theha\Documents\GIT\FarmHand
New-Item -ItemType Directory -Force -Path tmp\fh-pfp-dropin | Out-Null
tar -xzf tmp\farmhand-pfp-dropin.tgz -C tmp\fh-pfp-dropin
powershell -ExecutionPolicy Bypass -File tmp\fh-pfp-dropin\APPLY.ps1 -RepoRoot "C:\Users\theha\Documents\GIT\FarmHand" -DropinRoot "C:\Users\theha\Documents\GIT\FarmHand\tmp\fh-pfp-dropin"
```

User rebuilds Docker (`docker compose up -d --build`) for migrate deploy.

## Notes
- Does **not** commit/push
- Prefer applying after jobboard-ux / skip-shard if those are in WIP (FarmChoreClaim skip buttons need `allowsSkip` + `api.skipChore`)
- Sign art/layout: **additive badge only** — no plank redesign, no text shift
