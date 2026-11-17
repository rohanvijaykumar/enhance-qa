# Mode: check

**When:** the everyday pass. Code changed since the last tested build, or fixes are waiting to be verified. This is what a bare `/enhance-qa` usually runs.

## Scope

`qa select --json` gives the scope. In order:
1. **Smoke checks**, for the intake gate.
2. **Fixes to verify:** bugs with status `fixed`, whether QA's fixer or the user's own coding agent fixed them.
3. **Checks in changed areas:** areas whose `Paths` match files changed since the last tested build. High and medium risk first; low risk only in `thorough`.
4. **Regression checks** for bugs fixed since the last full pass, in the changed areas.
5. **Checks for new features:** changed files no area covers go to the scout (Job 3). The scout adds checks, and they run in this pass.
6. **Rotation:** the oldest-run checks, up to `rotation:` percent of the checklist.
7. **Human checks** whose area changed. These are prepared and listed, never run.

If `qa select` says `wide: true` (a big diff, a framework upgrade, build changes), say so in the announcement and suggest `full`. Run the check scope unless the user agrees to switch.

## Process

The phases in `workflow.md`:
1. Start: estimate and announce.
2. Intake gate.
3. Verify the waiting fixes (phase 7). Do this before testing, so reopened bugs show up in the same report.
4. Test (phase 3), with a spot audit of about 10% of passes.
5. Confirm candidates (phase 4), then triage (phase 5).
6. Fix and verify (phases 6–7), only for `fix-now` clear defects at Balanced or Autopilot. At Guided, list them and ask.
7. Report (phase 8).

## Escalation

- **An area that produced two or more new bugs in this pass** gets a suggestion for a focused area pass next time (defects cluster).
- **On live products,** after a release, suggest `prod` once the user has deployed.
