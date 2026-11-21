# Mode: fix

**When:** the user says "fix" or "fix the QA bugs", or a pass ends with `fix-now` bugs and autonomy allows fixing.

## Scope

- **Bugs with status `open` or `reopened`,** reproduced by the verifier (`repro:` on the current or previous build), priority `fix-now`.
- **Plus any bug the user named** ("fix BUG-021"), which counts as their approval of that fix.
- **Order:** severity, then area.
- **One round:** the whole list is fixed, then built once and verified once (`policies/fixing.md`, "Fix rounds"). Only a list longer than `fixes_per_batch` (default 20) is split into batches, each verified before the next.
- **Bugs that need a decision** (behaviour, looks, wording, data, auth, payments, dependencies; `checkpoints.md`) are skipped unless the user approved them. Ask about them before the round starts (step 3), so approved ones join it; the rest stay in "Needs you" with the recommended fix.

## Process

1. `qa lock acquire`, then `qa snapshot`. Record the starting build.
2. **Re-reproduce** any bug whose `repro:` is from an older build: a fast verifier run, so the fixer doesn't chase something already gone. Gone means `cant-reproduce` on this build; tell the user.
3. **One question before fixing,** covering both, in one message:
   - **checkpoint commit:** if there's uncommitted work and `checkpoint_commit: ask`: "Save your uncommitted changes as a checkpoint commit first, so each fix can be undone separately? (yes / no)". Store the answer in the plan;
   - **bugs that need a decision:** each with its recommended fix, asking which to include.
4. **Fix phase** (`workflow.md` phase 6). The fixer works through the whole list, one commit per bug, checking each fix on the quickest build that runs it.
5. **Verify phase** (phase 7). One new build, the intake gate once, then fresh verifiers by area, in parallel, check every fix with variants, the round's halo (`qa select --halo`) and the test-tampering review.
6. **Follow-up round,** only if bugs reopened: their second attempts together, one more build, and verification of just those bugs and their halo.
7. **Regression checks:** one per verified bug.
8. **Report:** fixed and verified, reopened, needs decision, and anything not attempted, with the reason.

## Safety stops

These protect the user's code; they're not cost limits.
- **Two reverts in a row:** stop fixing for this run, and report the remaining bugs as "not attempted: fixes kept failing", with the details.
- **A fix that breaks the intake gate:** revert it at once, then continue with the next bug.
- **Two failed attempts on one bug:** it becomes `needs-decision`, and the fixer moves on.
