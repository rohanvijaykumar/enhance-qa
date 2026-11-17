# Changelog

## 0.1.0 (unreleased)

First version.
- One skill (`/enhance-qa`, `$enhance-qa`) with ten modes: setup, check, full, release, fix, loop, area, bug, prod, status.
- Five roles with enforced separation: lead, scout, black-box testers, a fresh verifier, and a fixer that can't touch the checklist or close bugs.
- Plain-Markdown `qa/` folder: plan, notes, per-area checklist, one file per bug and per run, STATUS dashboard, coverage.
- Coverage library: base layer, 22 platform modules, 24 feature packs, 16 release gates, bring-your-own import.
- Helper scripts in Python and Node (no dependencies, parity-tested): snapshots, locks, phases and gates, impact selection, coverage, results, bugs, redaction, exports, hooks.
- Web driver (`drive-web.mjs`): one JSON plan per check, compact results, falls back to installed Chrome or Edge.
- Claude Code plugin (role agents, hooks) and Codex role files.
- "A pass that starts, finishes": no cap cuts a run short; turn budgets hand over to fresh agents; an optional spending limit pauses and resumes.
