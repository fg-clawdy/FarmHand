# FarmHand after-school chores drop-in — apply on Windows WIP checkout.
# Does NOT commit, push, clone, or docker rebuild.
# Copies UTF-8 TypeScript as binary-safe Copy-Item (preserves emoji).

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

Write-Host "=== FarmHand after-school chores apply ==="
Write-Host "Repo:   $RepoRoot"
Write-Host "Dropin: $DropinRoot"

# Preserve dishes-1-6 / clean-shoe-room by full-file replace of catalog only.
Copy-File "packages\shared\src\choreCatalog.ts"
Copy-File "packages\shared\src\choreCatalog.test.ts"

Write-Host "=== Running shared choreCatalog tests ==="
Set-Location (Join-Path $RepoRoot "packages\shared")
npx tsx --test src\choreCatalog.test.ts
if ($LASTEXITCODE -ne 0) { throw "choreCatalog tests failed with exit $LASTEXITCODE" }
Write-Host "=== DONE ==="
