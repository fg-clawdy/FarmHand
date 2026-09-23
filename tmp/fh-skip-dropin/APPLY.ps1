# FarmHand honest-skip (+1 seed shard) drop-in — Windows WIP checkout.
# Does NOT commit, push, clone, or docker rebuild.
# Copies UTF-8 TypeScript via Copy-Item (preserves emoji).

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

Write-Host "=== FarmHand honest-skip apply ==="
Write-Host "Repo:   $RepoRoot"
Write-Host "Dropin: $DropinRoot"

# Always ship 27-chore catalog with skip flags (idempotent if afterschool already applied).
Copy-File "packages\shared\src\choreCatalog.ts"
Copy-File "packages\shared\src\choreCatalog.test.ts"
Copy-File "packages\shared\src\choreSkip.ts"
Copy-File "packages\shared\src\choreSkip.test.ts"

Copy-File "apps\api\src\choreSkip.ts"
Copy-File "apps\api\prisma\migrations\20260922200000_chore_claim_skipped\migration.sql"

Copy-File "apps\player\src\components\JobBoard.tsx"

# Farm corkboard claim modal — only if that path exists or is expected
$farmClaimDst = Join-Path $RepoRoot "apps\player\src\components\FarmChoreClaim.tsx"
$farmClaimSrc = Join-Path $DropinRoot "apps\player\src\components\FarmChoreClaim.tsx"
if (Test-Path -LiteralPath $farmClaimDst) {
  Copy-Item -LiteralPath $farmClaimSrc -Destination $farmClaimDst -Force
  Write-Host "COPIED apps\player\src\components\FarmChoreClaim.tsx"
} else {
  # Still install so FarmDashboard can import it if WIP adds the path
  Ensure-Dir (Split-Path -Parent $farmClaimDst)
  Copy-Item -LiteralPath $farmClaimSrc -Destination $farmClaimDst -Force
  Write-Host "COPIED apps\player\src\components\FarmChoreClaim.tsx (new)"
}

Write-Host "=== Running patch_api.mjs ==="
$patchJs = Join-Path $DropinRoot "patch_api.mjs"
Push-Location $RepoRoot
try {
  node $patchJs $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw "patch_api.mjs failed with exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "=== Running shared skip/catalog tests ==="
Set-Location (Join-Path $RepoRoot "packages\shared")
npx tsx --test src\choreCatalog.test.ts src\choreSkip.test.ts
if ($LASTEXITCODE -ne 0) { throw "shared tests failed with exit $LASTEXITCODE" }

Write-Host "=== DONE ==="
Write-Host "Design: ChoreClaimStatus.SKIPPED + unique(choreId,playerId,periodKey) for period satisfaction."
Write-Host "Next (user): docker compose up -d --build  (prisma migrate deploy + seed syncs allowsSkip)"
