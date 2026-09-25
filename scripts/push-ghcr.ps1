# Build FarmHand images from THIS machine's tree and push to GitHub Container Registry.
# Requires: Docker, gh auth with write:packages (fg-clawdy already has this).
# Run in PowerShell from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\push-ghcr.ps1
# Optional: -Tag 2026-09-22

param(
  [string]$Tag = "latest",
  [string]$Prefix = "ghcr.io/fg-clawdy/farmhand",
  [string]$Owner = "fg-clawdy"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Logging into ghcr.io as $Owner ..."
$token = gh auth token
if (-not $token) { throw "gh auth token failed — run: gh auth login" }
$token | docker login ghcr.io -u $Owner --password-stdin
if ($LASTEXITCODE -ne 0) { throw "docker login ghcr.io failed" }

$services = @(
  @{ Name = "api"; Dockerfile = "apps/api/Dockerfile" },
  @{ Name = "player"; Dockerfile = "apps/player/Dockerfile" },
  @{ Name = "admin"; Dockerfile = "apps/admin/Dockerfile" },
  @{ Name = "parent"; Dockerfile = "apps/parent/Dockerfile" }
)

foreach ($s in $services) {
  $image = "$Prefix-$($s.Name):$Tag"
  Write-Host "Building $image ..."
  docker build -f $s.Dockerfile -t $image .
  if ($LASTEXITCODE -ne 0) { throw "build failed: $($s.Name)" }
  Write-Host "Pushing $image ..."
  docker push $image
  if ($LASTEXITCODE -ne 0) { throw "push failed: $($s.Name)" }
}

Write-Host ""
Write-Host "Pushed:"
foreach ($s in $services) { Write-Host "  $Prefix-$($s.Name):$Tag" }
Write-Host ""
Write-Host "On the Linux server, copy docker-compose.prod.yml, nginx/nginx.conf, and .env"
Write-Host "(from .env.production.example), then:"
Write-Host "  docker login ghcr.io"
Write-Host "  docker compose -f docker-compose.prod.yml pull"
Write-Host "  docker compose -f docker-compose.prod.yml up -d"
