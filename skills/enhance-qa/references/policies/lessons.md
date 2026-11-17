# Lessons: turning repeated bugs into rules

Fixing each instance of a mistake isn't enough when the same kind keeps coming back. A lesson teaches the user's coding agent not to make it again. This follows how the Claude Code and Codex teams work: repeated findings get fixed at the source (a lint rule, a check, an instruction file), not one bug at a time.

## When to propose a lesson

The lead proposes one in the report phase when either holds:
- **A repeated class.** Two or more bugs share a class (their `class:` field, from the fixer's notes or set at triage), and the class can be recognised from the code or a diff.
- **An escape.** A bug escaped QA (`source: escaped` or `reported`), and the miss shows a pattern that neither the checklist nor the coding agent's instructions cover.

Don't propose one for a single one-off bug, or for anything a regression check already fully covers.

## What a lesson becomes

Pick the strongest form that fits:
1. **A lint rule, type or test helper** the project's own tooling enforces. It applies everywhere at once. Its error message should say how to fix the problem, so a coding agent can act on it.
2. **A step in the project's `verify` skill,** for things a diff can trigger. For example: "When the diff touches `routes/api`, confirm every route that takes an ID checks the record belongs to the signed-in user."
3. **One line in CLAUDE.md or AGENTS.md** for the coding agent. Keep it short, specific and checkable, for example: "Validate cart quantities on the server: whole numbers from 1 to the stock level. Never trust the client." Put it under the `## QA (enhance-qa)` section if there is one, otherwise at the end.

The regression check is added anyway (`fixing.md`); a lesson goes further.

## Rules

- **Propose, don't write.** Each lesson is a "needs you" item with the exact text and where it would go. Editing lint config, the `verify` skill, CLAUDE.md or AGENTS.md needs the user's OK. Once approved, the lead makes exactly that edit and nothing else.
- **Few and short.** One line per lesson. Merge lessons of the same class instead of adding near-duplicates. An instruction file that grows without limit stops being read.
- **Record every lesson** in `qa/lessons.md`, including declined ones, so they aren't proposed again.
- **Prune** in `full` passes (`roles/scout.md`, Job 5). If a lesson's class hasn't recurred in 10 runs and a lint rule or test now enforces it, propose removing its CLAUDE.md or AGENTS.md line.

## `qa/lessons.md`

The lead creates it on the first lesson. One section per lesson:

```markdown
# Lessons

## L-001 · Trusting quantities from the client
- Class: trusts-client-quantity
- Bugs: BUG-004, BUG-023
- Rule: "Validate cart quantities on the server: whole numbers from 1 to the stock level. Never trust the client."
- Where: AGENTS.md, QA section
- Status: added 2026-11-17 (or: proposed, declined 2026-11-17)
```
