# Fixing

The fixer is a separate agent from the testers and the verifier. These rules bind it, and the lead enforces them.

1. **What gets fixed, and when.**
   - Clear defects get fixed automatically at Balanced (the list is in `checkpoints.md`). Anything that changes how the product behaves, looks or reads waits for the user's OK, and so do changes to data models, auth, payments, dependencies, and build or deploy config.
   - **During a test pass** (`check`, `full`, `release`), `fix_during_run` decides how much gets fixed. Testing comes first, and fixing everything inside a long pass can double its length:
     - `serious` (the default): S1 and S2 clear defects;
     - `clear`: every clear defect at the stage's `fix-now` bar;
     - `none`: report only.
   - **Everything else waits** for `/enhance-qa fix` or the user's own coding agent; each bug carries a paste-ready prompt.
   - `fix` mode and `loop` fix every eligible bug, because fixing is what the user asked them for.
   - The stage's bug bar decides "now" versus "later" (`severity.md`).
2. **No repro, no fix.** The fixer starts only on a bug the verifier has reproduced in the real product on the current build (`repro:` shows it). Inspecting state must never be what causes the symptom.
3. **Order.** Severity first, then grouped by area so the fixer keeps context.
4. **One bug, one commit.**
   - The message is `fix(qa): BUG-019 Wrong password shows a 500 page`, so any single fix can be undone with `git revert`.
   - Every fix commit is stamped with how it was checked before committing: trailers `QA-Bug:`, `QA-Test:` (the test, or `none` with the reason) and `QA-Checked:` (`roles/fixer.md` has an example). `git log --grep "QA-Test: none"` then finds fixes that went in without a test.
   - Before the first fix of a run, if there's uncommitted work, ask once whether to save it as a checkpoint commit (`chore(qa): checkpoint before QA fixes`). Remember the answer in `qa/plan.md` (`checkpoint_commit: yes|no`).
   - If the answer is no, fixes stay as uncommitted edits, listed per bug in the run file.
   - Without git, back up each file before editing it (`qa/.state/backup/<bug>/`) and list the changes.
5. **Tests.**
   - Run the project's existing tests, type checks and linter before committing.
   - Where the project has a test suite, first write a test that fails because of the bug, then make it pass. For a broken invariant, prefer a property-based test if the project already has a property library; adding one is a dependency change and needs the user's OK.
   - A fix counts only after two consecutive passes with the product freshly restarted.
   - Never delete or skip tests, loosen assertions, raise timeouts to hide a race, or turn off lint rules or type checks.
6. **Scope.** The smallest change that fixes the root cause, with no drive-by refactors and no new dependencies without the user's OK. The fix notes record the cause, the change, the files touched and the "halo": what else could be affected, which the verifier then tests.
   - **Fix the class, not just the line.** The fixer names the bug's class and searches for the same mistake. Instances in the same area and flow are the same root cause, so they're fixed in the same commit. Instances elsewhere come back to the lead as candidates, to be reproduced and filed like any other.
   - The bug's `class:` field records the class, so repeats can become lessons (`lessons.md`).
7. **Batches and safety stops.**
   - Fixes are made in batches of `fixes_per_batch` (default 20), each batch verified before the next, until every eligible bug is done.
   - Two attempts per bug. The second attempt starts over with a different approach, on the strong tier, instead of re-patching the same lines. A bug reopened twice goes to the user as `needs-decision`, with what was tried and a suggestion to rethink the approach, and the fixer moves on.
   - If two fixes in a row have to be reverted, fixing stops for this run: something bigger is wrong. Testing and reporting still finish.
8. **Verification.** A fresh verifier, never the fixer:
   - re-runs the exact reproduction on the new build;
   - varies it (other data, other paths, other screen sizes);
   - runs the checks around the fix;
   - reviews the diff for test tampering.

   The verdict:
   - **Verified:** the bug closes (`verified`).
   - **Not verified:** the bug reopens (`reopened`, attempts +1).
   - **Inconclusive:** it re-runs once, then the bug goes to the user.
9. **Regression.** Every verified bug adds a permanent check to the checklist, tagged `regression`, with `Source: BUG-NNN`. The scout or lead writes it, never the fixer. If replay is on, it also becomes an automated test.
10. **Where fixes go.** Commit to the branch QA is running on: the user's current branch, or the session's own worktree branch. Merging a worktree branch is the user's call. Never push, rewrite history or force anything.
11. **The user's own coding agent can fix bugs too.** The optional note in CLAUDE.md or AGENTS.md tells it where the bugs are, and asks it to set `status: fixed` with fix notes and leave verification to QA. The next `check` verifies those fixes like any other.

## Test-tampering review

The verifier runs `qa tamper-tests --since <build>` and reads the diff of every test file the fix touched. It flags:
- deleted or skipped tests (`.skip`, `xit`, `@pytest.mark.skip`, `#[ignore]`, `t.Skip`);
- `.only` or `fit`;
- removed or weakened assertions;
- changed expected values or snapshots without a matching product reason;
- raised timeouts or added retries in tests;
- lint or type checks disabled (`eslint-disable`, `# type: ignore`, `@ts-ignore`, `noqa`).

Any of these makes the fix **Not verified** until the user agrees to it.
