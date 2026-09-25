# FarmHand harden drop-in (nginx DNS + player guards + 90s garden idle)

Prepared by executor subagent. Apply on family machine `a43cce9d-c1df-41e3-b418-153291c86c94`
at `C:\Users\theha\Documents\GIT\FarmHand`.

## Files
- `nginx/nginx.conf` — Docker DNS `resolver 127.0.0.11 valid=10s ipv6=off` + variable proxy_pass (`$fh_player`, `$fh_admin`, `$fh_parent`, `$fh_api`)
- `apps/player/src/App.tsx` — bounce `/admin*` and `/parent*` to `/`
- `apps/player/src/hooks/useGardenIdleLock.ts` — 90s idle → `POST /api/session/logout` → `navigate('/')`
- `apps/player/src/screens/Garden.tsx` — calls `useGardenIdleLock(90_000)`
- `apps/player/vite.config.ts` — VitePWA `navigateFallbackDenylist` already excludes `/admin` `/parent` `/api` `/health`; `start_url: "/"`; `display: "standalone"`

## Apply (PowerShell on family machine after CopyFromBox of this folder)
```powershell
cd C:\Users\theha\Documents\GIT\FarmHand
# If copied to e.g. C:\Users\theha\fh-harden:
powershell -File C:\Users\theha\fh-harden\APPLY.ps1
```

Or manually Copy-Item the files, then:
```powershell
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
curl.exe -sI http://127.0.0.1/
```

Player code changes need: `docker compose up -d --build player` (user-run; do not rebuild unless asked).
Nginx-only verify works after reload without player rebuild.
