---
name: prd-creator
description: >
  Guide users through building a complete Product Requirements Document (PRD) via structured dialogue, then output it as a precise JSON artifact. Use this skill whenever a user says "create a PRD", "write a PRD", "I need a PRD for...", "help me define requirements", "scope out this feature", "generate user stories", "write acceptance criteria", "feature spec", "technical spec", or says "I want to build X" in a context that calls for structured planning. This skill runs a completeness-assessment loop — asking targeted questions until ≥95% confident — before generating the final PRD JSON. Always trigger this skill for any product requirements, feature scoping, or user story generation task, even if the request is casual or brief.
---

# PRD Creator

Guides Claude through a structured, iterative dialogue with the user to gather all information needed for a thorough Product Requirements Document, then emits a precise JSON PRD.

---

## Four-Phase Workflow

### Phase 1 — Silent Completeness Assessment

When triggered, silently assess your understanding across **8 dimensions**:

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Problem statement & business goals | 15% |
| 2 | Target users & personas | 12% |
| 3 | Core features & scope (in/out) | 18% |
| 4 | User stories & acceptance criteria | 18% |
| 5 | Technical constraints & dependencies | 12% |
| 6 | Non-functional requirements (perf, security, a11y) | 10% |
| 7 | Success metrics & KPIs | 8% |
| 8 | Timeline & priority | 7% |

Score each dimension 0–100%, multiply by its weight, sum. Display to user:

> 📊 **Data completeness: 34%** — I have enough to get started, but need more information before writing the PRD.

Then immediately begin Phase 2.

---

### Phase 2 — Exploratory Q&A Dialogue

**Rules (strictly follow these):**
- Ask **only 1–2 focused questions per turn** — never more
- Prioritize the **highest-weight gaps** first
- **Acknowledge and incorporate** each answer before moving on
- After each user response, **recalculate and display** the updated completeness %
- Be **specific and intelligent** — tailor questions to the product domain (e.g. for a task manager, ask about collaboration and conflict resolution, not generic software questions)
- Probe for: edge cases, what's explicitly OUT of scope, success metrics, rollout/migration concerns, technical constraints

**Good question examples:**
- "Who are the primary users — internal employees, external customers, or both? And roughly how many will use this at launch?"
- "What should happen if two users try to edit the same record simultaneously?"
- "What's explicitly out of scope for the first version?"
- "How will you measure success 90 days after launch?"
- "Are there existing systems this needs to integrate with, or data migration concerns?"

**Bad question examples (avoid):**
- "What features do you want?" (too vague)
- "Tell me more about the users." (not specific enough)
- "What are your requirements?" (defeats the purpose)

---

### Phase 3 — Threshold Check

After each exchange, evaluate completeness:

- **< 95%**: Continue dialogue. Show % and name the top 1–2 remaining gaps.
- **≥ 95%**: Pause and say:

> ✅ **Data completeness: 97%** — I have enough to write a thorough PRD. Is there anything else you'd like to add or clarify before I begin?

Wait for the user's confirmation or final additions before generating.

---

### Phase 4 — PRD Generation

Generate the full PRD as a **JSON code block** using exactly this structure:

```json
{
  "project": "<project name>",
  "branchName": "<author/feature-name in kebab-case>",
  "description": "<one-line description of what this delivers>",
  "userStories": [
    {
      "id": "US-001",
      "title": "<story title>",
      "description": "As a <persona>, I want to <action> so that <benefit>.",
      "acceptanceCriteria": [
        "<specific, testable criterion>",
        "<specific, testable criterion>",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

#### PRD Generation Rules

**Story ordering:** Order by implementation dependency — foundational/infrastructure work first, UI/polish last. `priority` is an integer (1 = first to implement).

**branchName:** Kebab-case, format `author/feature-name`. If the user's name is unknown, use `dev/feature-name`.

**Acceptance criteria must be:**
- Specific and testable — no vague criteria like "works correctly" or "is fast"
- Written as observable outcomes, not implementation steps
- Every story must include `"Typecheck passes"` as a criterion
- UI stories must also include `"Verify in browser using dev-browser skill"` as the **final** criterion

**Coverage:** Every agreed-upon feature must appear in at least one user story. No feature left behind.

**`passes`** always starts as `false`.

**`notes`** always starts as `""`.

**Story granularity:** Each story should represent a coherent, shippable unit of work. Not too large ("Build the entire auth system") and not too small ("Add a button").

---

## Completeness Scoring Reference

Use this to calibrate % assessments:

| Score | Meaning |
|-------|---------|
| 0% | No information on this dimension |
| 25% | Very vague — e.g. "users want to log in" |
| 50% | Partial — general shape known, details missing |
| 75% | Mostly clear — main flows known, edge cases unclear |
| 95%+ | Crisp — enough to write testable acceptance criteria |

A dimension only counts as 95%+ if you could write specific, testable acceptance criteria for it right now.

---

## Handling Tricky Situations

**User gives a very short initial prompt:** Start at low completeness (15–30%), ask about problem statement and users first.

**User pastes a large spec:** Re-assess completeness — it may jump to 70–80%. Focus remaining questions on gaps.

**User says "just write it":** Acknowledge, then write the best PRD you can with current info. Include a `notes` field on ambiguous stories flagging assumptions made.

**User wants to skip Q&A:** Generate with what you have, but flag each story where assumptions were made.

**Conflicting requirements:** Surface the conflict explicitly, ask the user to resolve it before continuing.
