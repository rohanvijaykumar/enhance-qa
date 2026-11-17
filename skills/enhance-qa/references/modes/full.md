# Mode: full

**When:**
- the first baseline;
- milestones;
- wide changes (`qa select` says `wide: true`);
- on a live product, every 30 days, every 10 releases or on a major upgrade;
- or the user asks for "everything".

## Scope

- **Every non-retired check,** in risk order (high first), so if the session is interrupted, the most important checks are already done.
- **The environment matrix pairwise:** every pair of dimension values appears in at least one cell. Use the platform modules' "Default matrix", recorded in `qa/plan.md` under "Environments".
- **One exploratory charter per area,** at the balanced tier, time-boxed (20 minutes by default; 30 for high-risk areas).
- **Human, device and gate checks:** prepared and listed, never run.

A full pass can be large. Estimate it honestly, and on Balanced ask for the one-line OK if it's above `confirm_over_usd`. The user can answer "go", "lean" or "split" (the highest-risk half now, the rest next time). Once it starts, it runs to the end. On a huge product it may span several sessions: progress is saved after every batch, and the next `/enhance-qa` resumes it.

## Process

All phases in `workflow.md`:
1. Start.
2. Intake gate.
3. Test: all areas, with testers in parallel batches by area.
4. Spot audit.
5. Confirm candidates, then triage.
6. Fix and verify, per autonomy.
7. Report.

At the end, set `last_full:` to today and `releases_since_full: 0` in the plan.

## Exit

A full pass ends with:
- the run file;
- coverage for every check (`qa coverage`);
- and, on Balanced, a "needs you" list that includes every unanswered question from the checklist.
