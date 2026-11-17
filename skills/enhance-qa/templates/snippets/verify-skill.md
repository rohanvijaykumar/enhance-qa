---
name: verify
description: Checks a change before it's committed. Runs the project's checks and enhance-qa's recorded test scripts, starts the app and tries the change like a user, then optionally a fast enhance-qa check of what changed.
---
# Verify before committing

Scripted checks first, cheapest first. If one fails, fix the cause and run it again.

1. **The project's own checks:** build, tests, type checks and linter. The commands are in `qa/notes.md` or CLAUDE.md.
2. **enhance-qa's recorded scripts,** if there are any: the checks with a `Replay:` path in `qa/checklist/`. Run those test files with the project's test runner. They cost no tokens.
3. **Try the change like a user:** start the app the way `qa/notes.md` says, then use the screen, command or endpoint the change touched once. Report what you saw, with the command and its output or a screenshot path.
4. **Optional, if `qa/plan.md` has `after_change_check: on`:** run a fast QA check of what changed with the enhance-qa skill ("enhance-qa quick check of what changed"). It reports possible problems without fixing or filing anything.

Rules:
- If a check still fails after three rounds of fixes, stop and tell the user what's failing and what you tried.
- Never get to green by skipping, loosening or deleting a test, adding sleeps, or retrying until it passes.
- Don't change `qa/` files.

<!-- Add this section to an existing verify skill instead of replacing it:
## enhance-qa
1. Run enhance-qa's recorded scripts: the checks with a `Replay:` path in `qa/checklist/`, with the project's test runner.
2. If `qa/plan.md` has `after_change_check: on`, run a fast QA check of what changed with the enhance-qa skill ("enhance-qa quick check of what changed"), and report possible problems before committing.
-->
