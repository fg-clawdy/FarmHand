# Apply FarmHand harden patches on the family machine.
# Run from anywhere with PowerShell. Does NOT commit/push or docker rebuild player.
$ErrorActionPreference = 'Stop'
$Repo = 'C:\Users\theha\Documents\GIT\FarmHand'
$Src = $PSScriptRoot
if (-not (Test-Path $Repo)) { throw "Repo not found: $Repo" }

Copy-Item -Force (Join-Path $Src 'nginx\nginx.conf') (Join-Path $Repo 'nginx\nginx.conf')
Copy-Item -Force (Join-Path $Src 'apps\player\src\App.tsx') (Join-Path $Repo 'apps\player\src\App.tsx')
New-Item -ItemType Directory -Force -Path (Join-Path $Repo 'apps\player\src\hooks') | Out-Null
Copy-Item -Force (Join-Path $Src 'apps\player\src\hooks\useGardenIdleLock.ts') (Join-Path $Repo 'apps\player\src\hooks\useGardenIdleLock.ts')
Copy-Item -Force (Join-Path $Src 'apps\player\src\screens\Garden.tsx') (Join-Path $Repo 'apps\player\src\screens\Garden.tsx')
Copy-Item -Force (Join-Path $Src 'apps\player\vite.config.ts') (Join-Path $Repo 'apps\player\vite.config.ts')

Set-Location $Repo
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
Start-Sleep -Seconds 1
Write-Output '=== curl -sI http://127.0.0.1/ ==='
curl.exe -sI http://127.0.0.1/
Write-Output '=== title sniff ==='
curl.exe -s http://127.0.0.1/ | Select-String -Pattern '<title>|FarmHand|Admin' | Select-Object -First 5
Write-Output 'Done. Player src changed — run: docker compose up -d --build player  (when ready)'
