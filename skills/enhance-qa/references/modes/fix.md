# Mode: fix

**When:** the user says "fix" or "fix the QA bugs", or a pass ends with `fix-now` bugs and autonomy allows fixing.

## Scope

- **Bugs with status `open` or `reopened`,** reproduced by the verifier (`repro:` on the current or previous build), priority `fix-now`.
- **Plus any bug the user named** ("fix BUG-021"), which counts as their approval of that fix.
- **Order:** severity, then area.
- **Batches:** `fixes_per_batch` at a time (default 20), each batch verified before the next starts, until the list is done.
- **Bugs that need a decision** (behaviour, looks, wording, data, auth, payments, dependencies; `checkpoints.md`) are skipped unless the user approved them. They're listed in "Needs you" with the recommended fix.

## Process

1. `qa lock acquire`, then `qa snapshot`. Record the starting build.
2. **Re-reproduce** any bug whose `repro:` is from an older build: a fast verifier run, so the fixer doesn't chase something already gone. Gone means `cant-reproduce` on this build; tell the user.
3. **Checkpoint commit:** if there's uncommitted work and `checkpoint_commit: ask`, ask once: "Save your uncommitted changes as a checkpoint commit first, so each fix can be undone separately? (yes / no)". Store the answer in the plan.
4. **Fix phase** (`workflow.md` phase 6). The fixer works through the list, one commit per bug.
5. **Verify phase** (phase 7). A fresh verifier checks every fix on the new build, with variants, the halo and the test-tampering review.
6. **Regression checks:** one per verified bug.
7. **Report:** fixed and verified, reopened, needs decision, and anything not attempted, with the reason.

## Safety stops

These protect the user's code; they're not cost limits.
- **Two reverts in a row:** stop fixing for this run, and report the remaining bugs as "not attempted: fixes kept failing", with the details.
- **A fix that breaks the intake gate:** revert it at once, then continue with the next bug.
- **Two failed attempts on one bug:** it becomes `needs-decision`, and the fixer moves on.
