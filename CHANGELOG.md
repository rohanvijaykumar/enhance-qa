# Changelog

## Unreleased

- README rewritten: a team diagram in light and dark (drawn by `.github/assets/src/make-visuals.mjs`), a section on the kinds of software it covers, and real install commands.
- Plugin manifests: homepage, repository and more keywords.

Aligned with how the Claude Code and Codex teams verify agent work (research note 13):
- **Testers and the verifier report what they saw.** A difference from the expected result is a failure, however small. Triage belongs to the lead and the user. Testers deliberately go past the happy path in exploratory sessions.
- **The fixer fixes the class, not the line.** It names the kind of mistake (the bug's new `class:` field) and fixes the same mistake elsewhere in the area. Instances in other areas go back to the lead as candidates.
- **Fixer details:**
  - a second attempt starts over with a different approach;
  - fix commits carry `QA-Bug`, `QA-Test` and `QA-Checked` trailers ("none" included);
  - invariant bugs get property-based tests when the project already has a property library.
- **Lessons** (`policies/lessons.md`, `qa/lessons.md`): two or more bugs of the same class, or an escaped bug, become a proposed rule for the coding agent. It can be a lint rule, a `verify` step or one line in CLAUDE.md or AGENTS.md, and is only added with the user's OK. Pruned in `full` passes.
- **The `verify` skill snippet runs scripted checks first:**
  - the project's checks;
  - the replay scripts;
  - one try of the change as a user;
  - the agent quick check, only when opted in.

  The snippet stops after three failed fix rounds.
- **`loop` defaults to 3 rounds** (`max_loop_rounds`), then steps back and reports what's left. After round 1 it re-tests only what changed.
- **Flaky checks and replays** are never made green with sleeps, longer timeouts or retries. With no cause found, they're retired with a written reason.
- **Bugs already there before a change** are tagged `pre-existing` and listed apart from what the change introduced.
- **A check whose expected result changed in the same commit as the code it judges** is tested against its previous expectation and raised under "Needs you".
- **Gardening in `full` passes:** the scout proposes retiring, merging or re-planning stale checks.
- **After-evidence for verified fixes**, including video: `drive-web.mjs` has a new `"video": "always"`.
- **A new `integrations/differential.md`:** the previous build as the oracle for rewrites and migrations.
- **Testing the skill:**
  - `run_zoo.py` gains `trials` and multi-trial scoring (pass@k, pass^k, recall by stage, review-based precision, stray files);
  - the bug-zoo apps are split into tuning, held-out and control sets, with a new bug-free control app (`cli-wordcount`);
  - new trigger tests (`tests/triggers/`).
- **Triggering:**
  - The first trigger tests started the skill on only 5 of 9 plain QA requests on a machine with many other plugins. Without those plugins, most of the misses started it.
  - The description now includes "test it like a real user" and "what's broken?".
  - The coding-agent note that setup offers now opens with a line routing QA requests to enhance-qa. That works however crowded the skill list is.
  - The trigger runner gains `--with-note` and `--clean`, gives the model 8 turns, and detects slash-command starts.

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
