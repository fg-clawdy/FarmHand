# FarmHand Job Board UX — apply on Windows family machine
$ErrorActionPreference = "Stop"
$Repo = if ($args.Count -ge 1) { $args[0] } else { "C:\Users\theha\Documents\GIT\FarmHand" }
$Dropin = if ($args.Count -ge 2) { $args[1] } else { $PSScriptRoot }

Write-Output "Repo=$Repo"
Write-Output "Dropin=$Dropin"
if (-not (Test-Path "$Repo\apps\player\src")) { throw "Missing player src under $Repo" }

# --- jobBoard.ts: insert getCurrentJob before debugHit( ---
$jobBoard = Join-Path $Repo "apps\player\src\pixi\jobBoard.ts"
$jb = Get-Content -Raw -LiteralPath $jobBoard
if ($jb -notmatch "getCurrentJob\(") {
  if ($jb -notmatch "debugHit\(") { throw "debugHit( not found in jobBoard.ts" }
  $block = @"
  /** Chore currently shown on the Wanted flyer (Farm stake tap target). */
  getCurrentJob(): WantedJob | null {
    return this.jobs[this.index] ?? null;
  }

  debugHit(
"@
  $jb = $jb.Replace("debugHit(", $block)
  Set-Content -LiteralPath $jobBoard -Value $jb -NoNewline
  Write-Output "INSERTED getCurrentJob into jobBoard.ts"
} else {
  Write-Output "SKIP jobBoard.ts (getCurrentJob present)"
}

# --- FarmScene.ts: insert getCurrentWantedJob after setWantedJobs method ---
$farmScene = Join-Path $Repo "apps\player\src\pixi\FarmScene.ts"
$fs = Get-Content -Raw -LiteralPath $farmScene
if ($fs -notmatch "getCurrentWantedJob\(") {
  $pattern = "(?s)(setWantedJobs\([^\)]*\)\s*\{.*?\n  \})"
  if ($fs -notmatch $pattern) { throw "setWantedJobs method not found in FarmScene.ts" }
  $insert = @"

  /** Wanted flyer chore currently displayed on the Farm Job Board stake. */
  getCurrentWantedJob() {
    return this.jobBoard.getCurrentJob();
  }
"@
  $fs2 = [regex]::Replace($fs, $pattern, { param($m) $m.Groups[1].Value + $insert }, 1)
  Set-Content -LiteralPath $farmScene -Value $fs2 -NoNewline
  Write-Output "INSERTED getCurrentWantedJob into FarmScene.ts"
} else {
  Write-Output "SKIP FarmScene.ts (getCurrentWantedJob present)"
}

# --- Copy UI files ---
$map = @(
  "apps\player\src\components\JobBoard.tsx",
  "apps\player\src\components\FarmChoreClaim.tsx",
  "apps\player\src\screens\FarmDashboard.tsx"
)
foreach ($rel in $map) {
  $from = Join-Path $Dropin $rel
  $to = Join-Path $Repo $rel
  if (-not (Test-Path -LiteralPath $from)) { throw "Missing $from" }
  $dir = Split-Path -Parent $to
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Copy-Item -Force -LiteralPath $from -Destination $to
  Write-Output "COPIED $rel"
}

Write-Output "DONE. Rebuild: docker compose up -d --build"
Write-Output "Verify: Farm stake -> current flyer chore modal with Name Claims buttons; Garden cards without Wanted art; corkboard flyers intact."
