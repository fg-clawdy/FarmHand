# FarmHand kid PFP drop-in — Windows WIP checkout.
# Does NOT commit, push, clone, or docker rebuild.
# Copies UTF-8 TypeScript/SVG via Copy-Item (preserves emoji).

param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$DropinRoot
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Copy-File([string]$Rel) {
  $src = Join-Path $DropinRoot $Rel
  $dst = Join-Path $RepoRoot $Rel
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Missing drop-in file: $src"
  }
  Ensure-Dir (Split-Path -Parent $dst)
  Copy-Item -LiteralPath $src -Destination $dst -Force
  Write-Host "COPIED $Rel"
}

Write-Host "=== FarmHand PFP apply ==="
Write-Host "Repo:   $RepoRoot"
Write-Host "Dropin: $DropinRoot"

# Shared
Copy-File "packages\shared\src\avatars.ts"
Copy-File "packages\shared\src\avatars.test.ts"

# API
Copy-File "apps\api\src\avatar.ts"
Copy-File "apps\api\prisma\migrations\20260922210000_player_avatar\migration.sql"
Copy-File "apps\api\prisma\SCHEMA_APPLY_NOTES.txt"
Copy-File "apps\api\prisma\schema.avatar.fragment.prisma"

# Player public presets (SVG)
$avatarIds = @("sun","seedling","star","rainbow","tractor","dog")
foreach ($id in $avatarIds) {
  Copy-File "apps\player\public\avatars\$id.svg"
}

# Player components
Copy-File "apps\player\src\components\KidAvatar.tsx"
Copy-File "apps\player\src\components\AvatarPicker.tsx"
Copy-File "apps\player\src\components\FarmChoreClaim.tsx"
Copy-File "apps\player\src\components\ProfileSheet.tsx"

# Pixi sign badge (does NOT move plank text)
Copy-File "apps\player\src\pixi\signAvatar.ts"
Copy-File "apps\player\src\pixi\FarmScene.ts"
Copy-File "apps\player\src\pixi\GardenScene.ts"
Copy-File "apps\player\src\pixi\usePixi.ts"

# Screens
Copy-File "apps\player\src\screens\FarmDashboard.tsx"
Copy-File "apps\player\src\screens\Garden.tsx"

# CSS fragment (also merged by patch_api)
Copy-File "apps\player\src\styles.avatar.css"

Write-Host "=== Running patch_api.mjs ==="
$patchJs = Join-Path $DropinRoot "patch_api.mjs"
Push-Location $RepoRoot
try {
  node $patchJs $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "patch_api.mjs failed with exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "=== Optional shared avatar tests ==="
$shared = Join-Path $RepoRoot "packages\shared"
if (Test-Path -LiteralPath (Join-Path $shared "src\avatars.test.ts")) {
  Push-Location $shared
  try {
    npx tsx --test src\avatars.test.ts
    if ($LASTEXITCODE -ne 0) { Write-Host "WARN avatars.test failed (non-fatal)" }
  } finally {
    Pop-Location
  }
}

Write-Host "=== DONE ==="
Write-Host "Design: avatarKind/preset/selfie + claim tiles + Profile Change picture."
Write-Host "Garden signs: circular PFP badge top-left (plank Name/seeds/points unchanged)."
Write-Host "Next (user): docker compose up -d --build  (prisma migrate deploy)"
