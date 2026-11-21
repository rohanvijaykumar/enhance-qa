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
6. **Scope.** The smallest change that fixes the root cause, with no drive-by refactors and no new dependencies without the user's OK. The fix notes record the cause, the change, the files touched and the "halo": the few checks that use the code it changed. The verifier tests the round's halo ("Fix rounds", below).
   - **Fix the class, not just the line.** The fixer names the bug's class and searches for the same mistake. Instances in the same area and flow are the same root cause, so they're fixed in the same commit. Instances elsewhere come back to the lead as candidates, to be reproduced and filed like any other.
   - The bug's `class:` field records the class, so repeats can become lessons (`lessons.md`).
7. **Batches and safety stops.**
   - Fixes go in one round ("Fix rounds", below). Only a list longer than `fixes_per_batch` (default 20) is split into batches, each verified before the next, until every eligible bug is done.
   - Two attempts per bug. The second attempt starts over with a different approach, on the strong tier, instead of re-patching the same lines. Bugs that reopen get their second attempt together, in one short follow-up round. A bug reopened twice goes to the user as `needs-decision`, with what was tried and a suggestion to rethink the approach, and the fixer moves on.
   - If two fixes in a row have to be reverted, fixing stops for this run: something bigger is wrong. Testing and reporting still finish.
8. **Verification.** A fresh verifier, never the fixer:
   - re-runs the exact reproduction on the new build;
   - varies it (other data, other paths, other screen sizes);
   - runs the round's halo: the checks around the changed code ("Fix rounds", below);
   - reviews the diff for test tampering.

   The verdict:
   - **Verified:** the bug closes (`verified`).
   - **Not verified:** the bug reopens (`reopened`, attempts +1).
   - **Inconclusive:** it re-runs once, then the bug goes to the user.
9. **Regression.** Every verified bug adds a permanent check to the checklist, tagged `regression`, with `Source: BUG-NNN`. The scout or lead writes it, never the fixer. If replay is on, it also becomes an automated test.
10. **Where fixes go.** Commit to the branch QA is running on: the user's current branch, or the session's own worktree branch. Merging a worktree branch is the user's call. Never push, rewrite history or force anything.
11. **The user's own coding agent can fix bugs too.** The optional note in CLAUDE.md or AGENTS.md tells it where the bugs are, and asks it to set `status: fixed` with fix notes and leave verification to QA. The next `check` verifies those fixes like any other.

## Fix rounds

A round is: fix the list, build once, verify once. On apps with slow builds, each extra round can cost an hour, so a fix run aims for one round, plus at most one short follow-up.

- **Everything approved goes in one round.** Before fixing starts, collect every bug the user approved, and ask any open "Needs you" questions about bugs on the list. Don't fix one group, report, then start another round for the rest.
- **The fixer's own checks use the quickest build that runs the changed code,** such as an incremental debug build. The verifier uses the build the testers used.
- **One build, one verification.** When the list is done, `qa snapshot` makes one new build and the intake gate (smoke) runs on it once. Then verifiers check every fix on that build: one per area, in parallel, each on its own lane.
- **The halo covers the code the fixes changed, once per round:**
  - `qa select --halo --base <build before the fixes>` lists the checks in areas whose `Paths` include a changed file, high-risk and regression checks first, 10 at most (`--max N` when a round touches many areas);
  - add any check a fixer named as using the same code;
  - each halo check runs once for the round, however many fixes touched its area. The smoke checks don't repeat.
- **Second attempts share one follow-up round.** Bugs that reopened get their second attempt together, then one more build, and the verifier re-checks only those bugs and their own halo. There's no third round: what still fails goes to the user as `needs-decision`.
- **Minor bugs after a long pass go to the user's coding agent.** When a pass ran for more than about an hour and only S3–S4 bugs are left to fix, the summary suggests pasting their prompts into the user's own coding agent. The next `check` then verifies them all at once, with no extra round. A QA fix round stays available (`/enhance-qa fix`), with an honest estimate: the fixes, one build and one verification.

## Test-tampering review

The verifier runs `qa tamper-tests --since <build>` and reads the diff of every test file the fix touched. It flags:
- deleted or skipped tests (`.skip`, `xit`, `@pytest.mark.skip`, `#[ignore]`, `t.Skip`);
- `.only` or `fit`;
- removed or weakened assertions;
- changed expected values or snapshots without a matching product reason;
- raised timeouts or added retries in tests;
- lint or type checks disabled (`eslint-disable`, `# type: ignore`, `@ts-ignore`, `noqa`).

Any of these makes the fix **Not verified** until the user agrees to it.
