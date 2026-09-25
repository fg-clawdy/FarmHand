# Parent: apply honest skip → +1 seed shard on Windows (machineId required)

## Blocker for this executor
Box-scoped subagent Shell/Read **cannot** target machine `a43cce9d-c1df-41e3-b418-153291c86c94` (no `machineId` / ListMachines / CopyFromBox). Drop-in is ready on the box.

## Design (period satisfaction)
- Extend Prisma `ChoreClaimStatus` with **`SKIPPED`**.
- Skip creates a `ChoreClaim` with `status=SKIPPED`, `resolvedAt=now`, **no** provisional seed / plot / parent push.
- Unique `(choreId, playerId, periodKey)` blocks second skip and claim-after-skip.
- Parent inbox stays `PENDING`-only → skips never queue.
- RACE: also takes `ChoreRaceSlot` for the period.
- `player.seedShards += SKIP_SHARD_REWARD` (1); activity `chore_skip`.

## Apply

```text
1) ListMachines → confirm a43cce9d-… connected
2) CopyFromBox:
     box_path: /workspace/fh-skip-shard/farmhand-skip-shard-dropin.tgz
     machineId: a43cce9d-c1df-41e3-b418-153291c86c94
     computer_path: C:\Users\theha\Documents\GIT\FarmHand\tmp\farmhand-skip-shard-dropin.tgz
3) Shell (machineId=a43cce9d-…), PowerShell-safe:

Set-Location C:\Users\theha\Documents\GIT\FarmHand
New-Item -ItemType Directory -Force -Path tmp\fh-skip-dropin | Out-Null
tar -xzf tmp\farmhand-skip-shard-dropin.tgz -C tmp\fh-skip-dropin
powershell -ExecutionPolicy Bypass -File tmp\fh-skip-dropin\APPLY.ps1 -RepoRoot "C:\Users\theha\Documents\GIT\FarmHand" -DropinRoot "C:\Users\theha\Documents\GIT\FarmHand\tmp\fh-skip-dropin"
```

User rebuilds Docker themselves (`prisma migrate deploy` applies SKIPPED enum; seed syncs `allowsSkip`).

## What lands
- Catalog 27 chores (includes after-school 6) + allowsSkip on optional set; take-out-trash now skippable
- Shared: `SKIP_SHARD_REWARD`, `choreSkipGate`, tests
- API: `POST /api/chores/:id/skip`, migration `20260922200000_chore_claim_skipped`
- Player: JobBoard "Not needed · +1 🔶", FarmChoreClaim per-kid skip, Garden/FarmJobFlow wiring
