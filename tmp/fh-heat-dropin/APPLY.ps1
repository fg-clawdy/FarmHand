# FarmHand chore HEAT drop-in — surgical apply on Windows WIP checkout.
# Usage:
#   Set-Location C:\Users\theha\Documents\GIT\FarmHand
#   powershell -ExecutionPolicy Bypass -File tmp\fh-heat-dropin\APPLY.ps1 -RepoRoot "C:\Users\theha\Documents\GIT\FarmHand" -DropinRoot "C:\Users\theha\Documents\GIT\FarmHand\tmp\fh-heat-dropin"
# Does NOT commit, push, clone, or docker rebuild.

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
  Ensure-Dir (Split-Path -Parent $dst)
  Copy-Item -LiteralPath $src -Destination $dst -Force
  Write-Host "COPIED $Rel"
}

Write-Host "=== FarmHand HEAT apply ==="
Write-Host "Repo:   $RepoRoot"
Write-Host "Dropin: $DropinRoot"

Copy-File "apps\api\src\choreHeat.ts"
Copy-File "apps\api\prisma\migrations\20260922180000_chore_board_heat\migration.sql"
Copy-File "packages\shared\src\choreSuggest.ts"
Copy-File "packages\shared\src\choreSuggest.test.ts"
Copy-File "apps\player\src\choreBoardEvents.ts"
Copy-File "apps\player\src\components\JobBoard.tsx"

# shared index export
$sharedIndex = Join-Path $RepoRoot "packages\shared\src\index.ts"
if (Test-Path -LiteralPath $sharedIndex) {
  $ix = Get-Content -LiteralPath $sharedIndex -Raw
  if ($ix -notmatch 'choreSuggest') {
    if (-not $ix.EndsWith("`n")) { $ix += "`n" }
    $ix += "export * from `"./choreSuggest.js`";`n"
    Set-Content -LiteralPath $sharedIndex -Value $ix -NoNewline
    Write-Host "PATCHED packages/shared/src/index.ts export"
  } else {
    Write-Host "OK shared index already exports choreSuggest"
  }
}

# package.json test script
$pkg = Join-Path $RepoRoot "packages\shared\package.json"
if (Test-Path -LiteralPath $pkg) {
  $pj = Get-Content -LiteralPath $pkg -Raw
  if ($pj -notmatch 'choreSuggest\.test') {
    $pj2 = $pj -replace 'src/store\.test\.ts"', 'src/store.test.ts src/choreSuggest.test.ts"'
    if ($pj2 -eq $pj) {
      $pj2 = $pj -replace '("test"\s*:\s*"[^"]+)"', '$1 src/choreSuggest.test.ts"'
    }
    Set-Content -LiteralPath $pkg -Value $pj2 -NoNewline
    Write-Host "PATCHED packages/shared/package.json test script"
  } else {
    Write-Host "OK shared package.json already lists choreSuggest.test"
  }
}

# Prisma schema
$schema = Join-Path $RepoRoot "apps\api\prisma\schema.prisma"
if (Test-Path -LiteralPath $schema) {
  $sch = Get-Content -LiteralPath $schema -Raw
  if ($sch -notmatch 'model ChoreHeat') {
    $frag = Get-Content -LiteralPath (Join-Path $DropinRoot "apps\api\prisma\schema.heat.fragment.prisma") -Raw
    if (-not $sch.EndsWith("`n")) { $sch += "`n" }
    $sch += "`n" + $frag
    if ($sch -notmatch 'choreBoardEvents') {
      $sch = $sch -replace '(starLedger\s+StarLedgerEvent\[\])', "`$1`r`n  choreBoardEvents        ChoreBoardEvent[]`r`n  choreHeats              ChoreHeat[]"
    }
    if ($sch -notmatch 'boardEvents\s+ChoreBoardEvent') {
      $sch = $sch -replace '(raceSlots\s+ChoreRaceSlot\[\])', "`$1`r`n  boardEvents     ChoreBoardEvent[]`r`n  heats           ChoreHeat[]"
    }
    Set-Content -LiteralPath $schema -Value $sch -NoNewline
    Write-Host "PATCHED schema.prisma (ChoreBoardEvent + ChoreHeat)"
  } else {
    Write-Host "OK schema already has ChoreHeat"
  }
}

Write-Host "Schema/shared/copy phase done — continuing with API patches..."

# Run Node surgical patches (chores/player/admin/index/api)
$patchJs = Join-Path $DropinRoot "patch_api.mjs"
if (Test-Path -LiteralPath $patchJs) {
  Push-Location $RepoRoot
  try {
    node $patchJs $RepoRoot
  } finally {
    Pop-Location
  }
} else {
  Write-Host "WARN missing patch_api.mjs"
}

Write-Host "=== HEAT apply done ==="
Write-Host "Next (user): docker compose up -d --build  (prisma migrate deploy)"
Write-Host "Test: Set-Location packages\shared; npx tsx --test src\choreSuggest.test.ts"
