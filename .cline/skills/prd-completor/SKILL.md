---
name: prd-completor
description: >
  Implements the highest-priority incomplete task from a PRD JSON file, then marks it complete. Use this skill whenever a user says "complete the next PRD task", "work on the PRD", "implement the next story", "continue the PRD", "do the next task", "prd-completor", or any variation of wanting to advance a PRD by implementing one user story. This skill reads the PRD, understands the full codebase context, implements exactly one task using best practices, updates the PRD to reflect completion, then stops. Always trigger this skill when a PRD.json exists and the user wants implementation to proceed — even if they phrase it casually like "keep going" or "next one".
---

# PRD Completor

Implements exactly one user story from a PRD JSON file — the highest-priority incomplete story — then updates the PRD and stops.

**Golden rule: one story in, one story out. Never implement more than one task per invocation.**

---

## Phase 1 — Locate and Parse the PRD

Search for the PRD file in this order:
1. Any path explicitly mentioned by the user
2. `PRD.json` in the current working directory
3. Recursively search for `PRD.json`, `prd.json`, `*.prd.json` in common locations (`./`, `./docs/`, `./planning/`)

Parse the JSON and validate it matches the expected schema (see prd-creator skill). If no valid PRD is found, tell the user and stop.

---

## Phase 2 — Select the Target Story

Find the **highest-priority incomplete story**:
- Filter to stories where `"passes": false`
- Sort by `priority` ascending (1 = highest priority)
- Select the first result

Announce the selected story clearly:

> 🎯 **Implementing: US-003 — User Authentication Flow** (Priority 1)
> *"As a visitor, I want to log in with my email so that I can access my dashboard."*

If **all stories have `passes: true`**, congratulate the user — the project is complete — and stop.

---

## Phase 3 — Codebase Analysis (Do this before writing a single line of code)

This phase is mandatory. Do not skip or rush it.

### 3a. Map the project structure

```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" \) \
  | grep -v node_modules | grep -v .git | grep -v dist | grep -v __pycache__ \
  | head -100
```

Build a mental map of: entry points, key modules, data models, utility/helper files, test patterns.

### 3b. Scan for relevant existing code

Before implementing anything in the story, identify what already exists that is related:
- Search for functions, classes, types, hooks, or utilities that overlap with the story's domain
- Check imports used by similar files to understand the conventions
- Identify the patterns used for: API calls, state management, error handling, styling, auth, data fetching

```bash
# Example: searching for existing auth-related code
grep -r "auth\|login\|session\|token" --include="*.ts" --include="*.tsx" -l .
```

### 3c. Read supporting documentation

Read the following if they exist (do not skip any that are present):
- `README.md` — architecture overview, setup, coding conventions
- `CLAUDE.md` or `AGENTS.md` — agent-specific instructions (treat these as **mandatory rules**)
- `docs/` — any markdown files in a docs folder
- `PRD.json` — re-read the `notes` fields on all stories for implementation guidance left by previous runs
- Inline `notes` on the **target story** — these may contain instructions from the user or prior agents

### 3d. Synthesize before acting

Produce a brief internal checklist (you do not need to show this to the user unless it is helpful):
- What existing functions/components will I reuse?
- What new files will I need to create?
- What is the correct pattern for this type of feature in this codebase?
- Are there any gotchas noted in the PRD notes or docs?
- What are the acceptance criteria, and how will I verify each one?

---

## Phase 4 — Implement the Story

### Implementation principles

**Reuse before creating.** If a utility, hook, component, type, or function already exists that does what you need — use it. Never create a duplicate. Never reimplement what exists.

**Follow existing patterns.** Match the code style, naming conventions, file structure, import style, and error-handling patterns already established in the codebase. When in doubt, find a similar file and mirror its structure.

**Acceptance criteria are your spec.** Each criterion in `acceptanceCriteria` is a requirement. Do not close the story unless every criterion is satisfied.

**Typecheck must pass.** Every story requires `"Typecheck passes"` as a criterion. Run the project's typecheck command before marking complete:
```bash
# TypeScript projects
npx tsc --noEmit

# Or check package.json for the project's typecheck script
npm run typecheck
npm run type-check
```

**UI stories need browser verification.** If the story has `"Verify in browser using dev-browser skill"` as a criterion, note this in the PRD `notes` field and flag it for the user — do not silently skip it.

### Use subagents for parallelizable work

When the implementation requires multiple independent pieces (e.g., writing backend logic + frontend component + tests), spawn parallel subagents to do them simultaneously. Coordinate results before finalizing.

### Work incrementally

- Make small, verifiable changes
- Run the typecheck or lint after each significant change
- If the project has tests, run relevant tests after implementation
- Check that existing tests still pass (do not break existing functionality)

---

## Phase 5 — Verify Acceptance Criteria

Go through each acceptance criterion one by one and confirm it is satisfied:

```
✅ User can submit email and password via login form
✅ Invalid credentials show an error message
✅ Successful login redirects to /dashboard
✅ Session is persisted across page refreshes
✅ Typecheck passes
⚠️  Verify in browser using dev-browser skill — flagged for user
```

Do not mark the story as passing unless all programmatically-verifiable criteria are confirmed. Flag any that require manual or browser verification with ⚠️ and note them clearly for the user.

---

## Phase 6 — Update the PRD

After implementation is complete and verified, update `PRD.json`:

### If the story is fully verified:
```json
{
  "id": "US-003",
  "passes": true,
  "notes": "Implemented using existing useAuth hook and AuthLayout component. JWT stored in httpOnly cookie via /api/auth endpoint. All AC verified programmatically. Browser verification pending."
}
```

### If a story is partially complete or blocked:
Do not set `passes: true`. Instead update `notes` with a clear status:
```json
{
  "notes": "BLOCKED: Depends on US-001 (database schema) which is not yet implemented. Recommend completing US-001 first."
}
```

### Notes field conventions (carried forward from prd-creator)
The `notes` field serves as the implementation log. Write notes that help the next agent or developer understand:
- What approach was used and why
- What existing code was reused
- Any decisions made that deviate from the acceptance criteria
- What remains for manual verification
- Any gotchas, caveats, or follow-up tasks discovered

---

## Phase 7 — Report and Stop

Produce a clear, concise summary for the user:

```
✅ Completed: US-003 — User Authentication Flow

**What was implemented:**
- Login form at /login using existing <Form> and <Input> components
- useAuth hook extended with signIn() method
- /api/auth/login route added (NextAuth pattern, matches existing /api/auth/logout)
- Redirect logic using existing useRouter pattern

**Reused existing code:**
- useAuth (src/hooks/useAuth.ts) — extended, not replaced
- AuthLayout (src/layouts/AuthLayout.tsx)
- Form, Input, Button from src/components/ui/

**Acceptance criteria:**
✅ All programmatic criteria verified
⚠️  "Verify in browser using dev-browser skill" — requires manual check

**PRD updated.** Next up: US-004 — Dashboard Overview (Priority 2)
```

Then **stop**. Do not proceed to the next story. The user must invoke the skill again for the next task.

---

## Edge Cases

**Story depends on an incomplete prerequisite:**
Check if the story references or logically depends on another incomplete story. If so, note the dependency in `notes`, recommend implementing the prerequisite first, and stop without implementing.

**Acceptance criteria are ambiguous:**
Before implementing, surface the ambiguity to the user and ask for clarification. Do not guess on business-logic-level decisions.

**PRD notes contain implementation instructions:**
Treat any content in a story's `notes` field as a directive from the user or previous agent. Respect it.

**CLAUDE.md or AGENTS.md exists:**
Its contents are **mandatory rules** for this project. They override your defaults. Read it fully in Phase 3c and apply every instruction it contains.

**Tests fail after implementation:**
Do not mark `passes: true`. Fix the regression before closing the story. If fixing it is out of scope for this story, document it in `notes` and surface it to the user.
