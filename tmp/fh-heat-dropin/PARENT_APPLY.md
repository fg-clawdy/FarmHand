# Parent: apply chore HEAT on Windows (machineId required)

## Blocker for this executor
Subagent Shell/Read **cannot** target machine `a43cce9d-c1df-41e3-b418-153291c86c94` (no `machineId` / ListMachines / CopyFromBox in this toolset). Drop-in is ready on the box.

## Apply (you have ListMachines + CopyFromBox + Shell with machineId)

```text
1) ListMachines → confirm a43cce9d-… connected
2) CopyFromBox:
     box_path: /workspace/fh-heat/farmhand-chore-heat-dropin.tgz
     machineId: a43cce9d-c1df-41e3-b418-153291c86c94
     computer_path: C:\Users\theha\Documents\GIT\FarmHand\tmp\farmhand-chore-heat-dropin.tgz
3) Shell (machineId=a43cce9d-…), PowerShell-safe separate commands:

Set-Location C:\Users\theha\Documents\GIT\FarmHand
New-Item -ItemType Directory -Force -Path tmp | Out-Null
tar -xzf tmp\farmhand-chore-heat-dropin.tgz -C tmp\fh-heat-dropin-extract
# if tar extracts flat into cwd of -C, prefer:
# New-Item … tmp\fh-heat-dropin; tar -xzf … -C tmp\fh-heat-dropin

# Safer extract:
New-Item -ItemType Directory -Force -Path tmp\fh-heat-dropin | Out-Null
tar -xzf tmp\farmhand-chore-heat-dropin.tgz -C tmp\fh-heat-dropin

powershell -ExecutionPolicy Bypass -File tmp\fh-heat-dropin\APPLY.ps1 -RepoRoot "C:\Users\theha\Documents\GIT\FarmHand" -DropinRoot "C:\Users\theha\Documents\GIT\FarmHand\tmp\fh-heat-dropin"

# Optional shared tests:
Set-Location C:\Users\theha\Documents\GIT\FarmHand\packages\shared
npx tsx --test src\choreSuggest.test.ts
```

User rebuilds Docker themselves.

## What lands
- Prisma: ChoreBoardEvent + ChoreHeat (+ migration 20260922180000_chore_board_heat)
- API: choreHeat.ts, POST /api/chores/board-events, claim EMA bump, nightly 03:00 America/Chicago, admin POST /api/admin/chores/heat/refresh
- Shared: choreSuggest heatByChoreId (+0..25), tests
- Player: JobBoard open/dismiss/impression events + heatScore into partition; PublicChore.heatScore
