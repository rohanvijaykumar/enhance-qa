# Mode: loop

**When:** the user says "loop", "until clean" or "keep going", or the stage is near-release and the plan says loop.

## The loop

Repeat until a stop condition holds:
1. **`check`** over what changed since the last round, plus any areas that had bugs last round. The first round uses the normal `check` scope.
2. **`fix`** the `fix-now` clear defects, plus anything the user approved.
3. **Verify** the fixes on the new build.
4. **Re-check the exit criteria** (`policies/stages.md`; the plan's `exit_criteria:`).

## Stop when

- **The exit criteria are met.** Report "exit criteria met", and suggest `release` if the stage calls for it.
- **A fresh pass finds nothing new:** a round with no new reproduced bugs and no reopened ones.
- **Everything left needs the user:** only `needs-decision` bugs, questions or human checks remain.
- **It stops converging:** the same bugs reopen round after round, or each round's fixes cause as many new bugs as they close. Stop, and report the pattern as a "needs you" item (it usually means a design problem, not a bug).
- **Three rounds, then step back:** `max_loop_rounds` (default 3). Extra rounds mostly re-find old problems, so after the last round the loop stops. It reports each bug still open, what was tried and why it didn't converge, as one "needs you" item suggesting the approach be rethought. The user can raise the number in the plan.
- **The user's own spending limit,** only if they set `max_usd_per_run`. The loop saves its state and resumes on the next run.

Fixing inside the loop also has a safety stop: two reverts in a row end fixing for that round, but the round's testing and report still finish.

## Between rounds

- Each round is its own run file (`008-loop.md`, `009-loop.md`), with one line at the top linking the previous round.
- **After round 1, re-test only what the round's fixes changed,** plus the areas that had bugs. Don't re-file anything already filed, dismissed or listed under "Don't report".
- The summary at the end covers all rounds:
  - bugs found and fixed per round;
  - what's still open;
  - why it stopped.
