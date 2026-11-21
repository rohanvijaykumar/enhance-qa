# Changelog

## Unreleased

From the second real-project run: the new rules cut the noise (25 bugs, 4 cosmetic, 10 non-bugs dropped), but the app allows only one copy, so the pass ran on one lane for almost 7 hours, and three fix rounds took about an hour each.
- **Parallel lanes for apps that allow only one copy** (`platforms/drivers.md`, "Several copies at once"; `coverage/platforms/electron-tauri.md`, "Parallel lanes"):
  - each lane gets its own identity: the app's own profile option, a user data folder per copy for Electron, or a lane build with its own app ID for Tauri (`tauri build --config`, so `tauri.conf.json` stays untouched);
  - never by editing the product's files; lane builds use their own output folder;
  - proven once with two lanes before fanning out;
  - the clipboard, notifications, deep links and other machine-wide or identity checks stay on lane 1;
  - lane builds and data folders are cleaned up at the end; the recipe stays in `qa/notes.md`.
- **Cheaper fix rounds** (`policies/fixing.md`, "Fix rounds"):
  - everything approved goes in one round: open questions about those bugs are asked first;
  - one build, the intake gate once, then verifiers by area in parallel;
  - the halo covers only the code the fixes changed, each check once per round;
  - the fixer's own checks may use the quickest build that runs the change;
  - reopened bugs share one follow-up round, never a third;
  - after a long pass, minor bugs left are suggested for the user's own coding agent, verified by the next `check`.
- **`qa select --halo [--base N] [--max N]`:** the checks around the code changed since build N, high-risk and regression checks first, 10 at most, with no smoke or rotation. Both script versions; covered by the parity test.

From the first real-project run: a full pass of a desktop video app took about 6 hours. It filed 45 bugs, 26 of them cosmetic or wishes, and fixed bugs in the middle of testing.
- **Bugs only** (`policies/signal.md`, "Bugs, not wishes"):
  - a finding is filed only when it breaks a promise the product makes, or does real harm;
  - missing features, suggestions, nice-to-haves and QA's own numeric targets are never filed or reported, only counted on the run's Signal line;
  - the verifier gains a `Not a bug` verdict;
  - S4 means a small visible defect, not polish.
- **Full coverage, of what exists:**
  - the scout covers every function a person can reach;
  - it never writes checks for features the product doesn't have, or targets it never states;
  - checks without a stated target record a baseline instead of failing;
  - a failure against an assumed expectation is a bug only if it also does harm.
- **Fixing in a pass:** `fix_during_run` (default `serious`) limits a test pass to fixing S1–S2. The rest wait for `fix` or the user's agent; `fix` and `loop` still fix everything eligible.
- **Pace check:** after the first round of batches, the lead re-estimates from the real pace. If the rest will take more than about 1.5× what was announced, it offers "keep going", "high-risk first" or "stop after this round", and the next run resumes. Kickoffs state honest times for slow apps, with "split".
- **Speed without testing less:**
  - checks that share setup run together;
  - the scout prepares small fixtures in `qa/evidence/fixtures/`;
  - up to 5 lanes when the machine allows;
  - verifiers work by area, with one reproduction for deterministic failures;
  - time-per-check estimates now differ by app type.

## Earlier in this release

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
