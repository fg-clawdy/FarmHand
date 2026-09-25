# Phase 2 — Kid Profile

The Farm Store is not a history dump. Each PIN-session kid opens a **Profile** from their garden for the complete overview.

## Entry

Garden top bar, tablet-sized:

- Tap the **name / mascot plaque** (`{name}'s garden`)
- Or the **Profile** button (next to 🏅)

Same PIN session as the garden. The farm dashboard still opens the Store building for buying only.

## Sections

Profile reads shared APIs (`GET /api/profile`). It does not keep a second history only inside Store components.

1. **Identity** — name, mascot, garden label
2. **Star wallet** — available now; stars set aside while a grown-up decides (`heldStars`); lifetime earned (and spent when useful)
3. **Pouch** — seeds + fertilizer (same counts as the garden HUD)
4. **Recent selfies** — JPEGs in the Immich-watched drop named `{day}_{name}_{playerId8}_{stamp}.jpg`. Missing files fail soft. Served at `GET /api/profile/selfies/:file` for that kid only.
5. **Rewards** — Pending / Owned (ready to use) / Redeemed (used stamp + date). Denied is historical and not a happy-path tab.
6. **Accolades** — embeds the same seasonal + lifetime ledger as the garden 🏅 panel (`/api/accolades`)
7. **Lately** — short strip from existing `activityLog` (harvest, store approve/redeem, chore approve)

## Store vs Profile

| | Farm Store | Profile |
| --- | --- | --- |
| Shop catalog | Yes | No |
| Request / hold | Yes | No |
| Waiting on a grown-up | Light list | Full pending |
| Owned (use later) | Actionable list | Overview |
| Redeemed / lifetime / badges / selfies | No | Yes |

## Parent / Admin

- Parent **Kids** (`/parent/kids`) shows the same wallet + reward lists read-only next to chore graphs.
- Parent **Store** keeps Approve / Deny / Mark redeemed plus catalog.
- Admin player detail shows available / held / lifetime earned. No kid-profile chrome in Admin.

See ledger rules in [`phase-2-store.md`](phase-2-store.md).
