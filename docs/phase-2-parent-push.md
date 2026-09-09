# Phase 2 — Parent PWA Web Push

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Parent PWA notifications (REQUIRED).

Chore claim rules and the in-app inbox are unchanged. Push is an extra path onto the **same** atomic Approve | Deny endpoints. Store catalog fulfillment is **not** in this slice; the send/clear helpers are stubbed (`notifyStoreRedemptionPending` / `notifyStoreRedemptionResolved`) so store can reuse the pattern later.

## What shipped

1. **Installable Parent PWA** at `/parent/` (manifest + `/parent/sw.js`).
2. **VAPID Web Push.** Parent devices subscribe after login. Subscriptions are stored per admin user / device endpoint.
3. **Actionable notifications** on chore claims: **Approve | Deny**. Tapping an action calls `POST /api/parent/claims/:id/approve|deny` with a short-lived action token (Bearer). The inbox uses the same routes with the `fh_admin` cookie.
4. **CRITICAL dog chores** use distinctive copy (`Dog chore — …`) and `requireInteraction`.
5. **Multi-parent clear:** the first successful approve/deny wins. A `clear` push with the same notification `tag` (`approval:chore_claim:<claimId>`) replaces/dismisses the live actions on other subscribed devices. A second tap gets “already handled” or “stale — open the inbox.”
6. **Inbox remains the fallback** if permission is denied, the SW is missing, the payload is stale, or VAPID keys are unset.

## Environment

Never commit the private key.

```bash
npm run vapid-keys -w @farmhand/api
```

Copy the printed lines into `.env`:

| Variable | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Application server key (browser subscribe) |
| `VAPID_PRIVATE_KEY` | Server signing key (keep secret) |
| `VAPID_SUBJECT` | `mailto:` or `https:` contact (default `mailto:farmhand@localhost`) |

Then recreate the API container so it sees the keys:

```bash
docker compose up -d --build api parent nginx
```

If the keys are blank, `GET /api/parent/push/config` returns `enabled: false`. Parents still Approve | Deny in the inbox.

## HTTPS / trusted local

Browsers only allow Web Push on a **secure context**:

- `https://` (required on phones and for “Add to Home Screen” push)
- `http://localhost` / `http://127.0.0.1` (desktop Chrome treats these as secure)

A raw `http://192.168.x.x:8080` LAN URL is **not** a secure context. For home self-host:

1. Put TLS in front of this compose stack (Caddy, nginx, Tailscale Serve, etc.).
2. Set `COOKIE_SECURE=true` when cookies should be HTTPS-only.
3. Install the Parent PWA from that HTTPS origin.

Chrome can temporarily allow an origin via `chrome://flags/#unsafely-treat-insecure-origin-as-secure` — fine for a lab, not the family-phone path.

## Install and enable

1. Open `/parent/` (Compose: `http://127.0.0.1:8080/parent/` when `HTTP_PORT=8080`).
2. Sign in (`admin` / `farmhand-dev` on a fresh seed).
3. Chrome / Edge / Android: **Install app** / Add to Home screen (optional but recommended).
4. Inbox → **Enable notifications** → allow the permission.

Safari iOS 16.4+ needs the PWA added to the Home Screen before push works.

## Verify (two browsers or devices)

Use two Parent sessions. Same account on two browsers is enough to prove dismiss; two admin users also works if you add a second row in `Admin`.

1. Enable notifications on **both** devices.
2. As a kid (Willow `1111`), claim a chore from the Job Board so a grey WAITING plant appears. Prefer a **CRITICAL** dog chore if it is still open.
3. Both devices should show an Approve | Deny notification (dog chores say **Dog chore —**).
4. On device A, tap **Approve** (or Approve in the inbox). The plant starts growing.
5. Device B: the live Approve | Deny notification is replaced/dismissed. Tapping a leftover action should not double-resolve (`A grown-up already handled that one.` / stale token → inbox).
6. Deny path: claim another chore, **Deny** from the other device → wilt → kid prunes, no seed return.
7. Turn off notifications, or use a browser with push blocked: the inbox still lists the pending row and the same buttons work.

`scripts/smoke.mjs` covers subscribe/unsubscribe plus the existing atomic approve/deny lifecycle. It cannot deliver a real FCM/APNs notification (needs HTTPS + a real browser permission). Config `subscribed` may stay true after the smoke endpoint is removed if another parent device is already registered.

## Service worker

- URL: `/parent/sw.js` (scope `/parent/`).
- nginx sends `Content-Type: application/javascript`, `Cache-Control: no-cache`, and `Service-Worker-Allowed: /parent/`.
- Notification `tag` is `approval:<kind>:<id>` so a later `clear` payload collapses the same claim (and the same pattern will work for `store_redemption`).
