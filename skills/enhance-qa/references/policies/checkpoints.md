# Human checkpoints

Three autonomy levels, set at kickoff and changeable any time in `qa/plan.md` (`autonomy:`):
- **Guided** asks more.
- **Balanced** is the default.
- **Autopilot** asks least.

Some checkpoints apply at every level.

| Checkpoint | When | Balanced (default) | Guided | Autopilot |
|---|---|---|---|---|
| **Kickoff** | First run only | One message with guesses filled in; reply "go" or correct a line | Same, plus a review of the checklist before testing | Skipped when the README or AGENTS.md already answers it; assumptions go in the report |
| **Unclear expected results** | Setup and new features | Listed as "questions for you"; testing continues, and those checks wait | Blocks until answered | The lead decides from product norms and marks the check `Assumed: yes` |
| **Big run** | Estimate above `confirm_over_usd`, before the pass starts | One-line confirmation ("go", "lean" or "split"); then it runs to the end | Always confirms | Never asks |
| **Judgement calls** (bug or by design? defer? won't fix?) | Triage | Batched at the end of the run; the bug waits as `needs-decision` | Same | The lead decides conservatively and logs it |
| **Fixes that change behaviour, looks, wording, data, auth, payments or dependencies** | Before fixing | Asks, batched | Asks for every fix | Fixes on a branch; the user reviews before merging |
| **Clear defects** | Before fixing | Fixed automatically, one commit each | Asks | Fixed automatically |
| **Human-only checks** (feel, sound, real devices, real payments, store submission) | Whenever relevant | Listed with exact steps. Never auto-passed. Must be done or explicitly waived before release | Same | Same |
| **Go / no-go** | Release | The best verdict is "Ready for your approval", with the evidence; the user decides | Same | Same |
| **Anything with outside effects** (real emails, SMS or payments; posting; deploying; changing production data) | Any time | Always asks | Always asks | Always asks |

## What counts as a clear defect

Fixed without asking at Balanced:
- crashes, hangs and unhandled exceptions;
- error pages, 500s and broken links or routes;
- console and log errors caused by the product;
- validation that fails open or rejects valid input;
- accessibility failures with an obvious fix (missing label, missing alt text, focus trap, contrast fixed in the existing palette);
- typos and placeholder text in the product's own strings;
- anything that contradicts the product's own docs or UI, where the fix restores the documented behaviour;
- **regressions:** behaviour that passed on an earlier build and now fails, where the fix restores what it did before (the history oracle). Check the earlier run's result and evidence to confirm.

Not a clear defect, so it asks first:
- new or changed behaviour, flows, layout or visual design;
- wording beyond a typo;
- data models, migrations or stored data;
- auth, permissions, sessions or security posture;
- payments, pricing or entitlements;
- dependencies (adding, removing or upgrading);
- build, CI and deploy config;
- deleting features or tests.

## Non-interactive runs

When there's no one to ask (`claude -p`, `codex exec`, CI, a background session):
- **Kickoff:** proceed with the best guesses only if the user's prompt says so ("go", "use defaults", "non-interactive"); otherwise write the kickoff into the run file and stop after recon.
- **Big run:** run the announced scope to the end. Only a `max_usd_per_run` the user set can pause it, and the next run resumes it.
- **Every "asks" above** becomes a "needs you" item; the work it guards waits.

## The "needs you" list

One list per run, at the end of the run file and in STATUS. Each item is one line: the bug or check ID, the question, and the options, with the recommended option first. For example:

`- [ ] BUG-018 "Delete account" has no confirmation step. Bug (add a confirmation) or by design?`

The user answers by ticking, or by writing after an arrow (`→ by design`) in `qa/STATUS.md`. `qa ingest` collects ticks and answers at the start of the next run, and the lead applies them.
