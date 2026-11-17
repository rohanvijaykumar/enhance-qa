
## QA (enhance-qa)
For QA requests (test the app like a real user, a bug bash, "is this ready to ship?", "check what I just changed", a release go/no-go, logging a bug), use the enhance-qa skill: `/enhance-qa` in Claude Code, `$enhance-qa` in Codex.
QA records live in `qa/` (start with `qa/STATUS.md`); bugs are in `qa/bugs/`, each with a "Prompt for your coding agent".
If you fix a QA bug, set its `status: fixed` and fill in its "Fix notes", but leave verification to QA: don't set `verified`, and don't edit `qa/checklist/`.
Lessons from repeated QA bugs are added below as one-line rules (see `qa/lessons.md`). Follow them.
<!-- Optional, only when the user turned on after-change checks:
After finishing a change, run the project's checks and enhance-qa's replay scripts (the checks with a `Replay:` path), then `$enhance-qa quick check of what changed`, and report possible problems.
-->
