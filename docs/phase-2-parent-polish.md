# Phase 2 — Parent PWA polish (chore CRUD + kid graphs)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Parent PWA.

This slice is the non-tech daily driver at `/parent/`. It does **not** collapse into Admin. Store catalog/fulfillment is still out of scope (nav stub only). Effort banding, face-ID, Admin redesign, and Player Job Board redesign stay out of scope.

Inbox Approve | Deny and Web Push are unchanged: [`phase-2-parent-push.md`](phase-2-parent-push.md). Claim / purgatory / Job Board: [`phase-2-chores.md`](phase-2-chores.md).

## What shipped

1. **Chores tab** — list every chore (on and off). **Must do** (CRITICAL) dog chores sort first and stay tagged. **Turn on / Turn off** from the list (Set Out School Clothes stays off until a parent turns it on). **Add / Edit** the v1 fields: title, emoji, note, how often, time of day, priority, minutes (display only), needs your OK, photo, skip, Job Board, on/off, who can claim.
2. **Who can claim** — **Every kid** (ALL / `isGlobal`), **First one to claim** (RACE), or **Only these kids** (SPECIFIC + checkboxes). No Family tenant.
3. **Seed grant stays 1.** No UI to band seeds by minutes. Minutes are a parent note only.
4. **Kids tab** — per-kid claimed / approved / denied bars for a Chicago **week** or **month**, a simple streak (consecutive Chicago days with ≥1 approved chore; an empty today does not break yesterday), and which jobs got done. CSS bars, not Admin harvest KPIs.
5. **Store** nav stub: “Coming soon.”
6. **Inbox** still Approve | Deny, optional photo proof, and push settings. Same `fh_admin` login; stay on `/parent/`.

Parent chore writes live under **`/api/parent/...`**, not `/api/admin`.

API boot **creates missing catalog rows only**. It no longer overwrites parent edits on restart.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/parent/chores` | All chores, CRITICAL first, includes `assignments` / `assignedPlayerIds` / `seedGrant: 1` |
| GET | `/api/parent/chores/:id` | One chore |
| POST | `/api/parent/chores` | Create |
| PATCH | `/api/parent/chores/:id` | Partial update, including `isActive` and assignment |
| GET | `/api/parent/kids` | Active players (Willow / Finn / Sage on a fresh seed) |
| GET | `/api/parent/stats?range=week\|month` | Per-kid claims, approvals, denials, streak, daily series, per-chore breakdown |
| GET | `/api/parent/claims/:id/photo` | JPEG if the claim has proof |

## Verify

Demo PINs: Willow `1111` / Finn `2222` / Sage `3333`. Parent: `admin` / `farmhand-dev`.

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Manual (phone-sized window is fine):

1. Open [http://127.0.0.1:8080/parent/](http://127.0.0.1:8080/parent/) → sign in. You should stay on `/parent/` (not `/admin`).
2. **Inbox** — if a kid claimed from the Job Board, Approve | Deny still work. Photo chores show the picture. Notifications card is still on this screen.
3. **Chores** — dog jobs (Feed Dog A.M./P.M., Walk the Dog) are at the top with **Must do**. Set Out School Clothes is **Off**. Turn it on, reload, it stays on; turn it back off if you want the seed default.
4. **Edit** a chore: change who can claim (every kid / race / only Willow). Save. Kid Job Board / claim rules follow that without opening Admin.
5. **Add a chore** if you want — still 1 waiting seed per claim. Do not look for a seed-amount control (there isn’t one).
6. **Kids** — This week / This month. After Willow claims and you approve, her claimed/approved bars and streak move. Finn/Sage cards stay visible even at zero.
7. **Store** says coming soon.
8. Player Job Board + selfie watering + purgatory are unchanged.

Dog chores keep CRITICAL unless you explicitly change **Priority** on the edit screen.
