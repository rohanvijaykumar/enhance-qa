# Differential testing: the previous build as the oracle

For rewrites, migrations, ports and big refactors, the behaviour is supposed to stay the same, so the old build is the best oracle there is. Run the old build and the new build side by side on the same inputs. Any difference is either a bug or an intended change.

## When to use it

- The user says "rewrite", "migration", "port", "refactor" or "should behave the same".
- Or `qa select` reports `wide: true` and the changed areas' checks still expect the same behaviour as before.

Offer it in the announcement. It takes longer, because two copies of the app run.

## How

1. **Start the previous tested build** from its snapshot, in a temporary worktree, on another port or data folder:
   - `git worktree add <temp folder> <snapshot commit of the last tested build>`. The commit is in `qa/.state/builds.json`.
   - Never point both builds at the same database or files, and never at production.
2. **Pick the inputs:**
   - the changed areas' checks;
   - generated inputs where the product takes data: random valid and edge-case values, a sample of the test fixtures. CLIs and APIs suit this best.
3. **Run the same inputs against both builds,** and record the outputs: responses, rendered text, files written, exit codes.
4. **Normalise what doesn't matter:**
   - timestamps, generated IDs, ordering where order isn't meaningful;
   - whitespace;
   - list the normalisations in `qa/notes.md` under "Differential".
5. **Compare.** Every remaining difference is a candidate, filed through the verifier as usual:
   - expected "same as before";
   - actual "differs from build N", with both outputs as evidence.
6. **Approved differences:** intended changes go in `qa/notes.md` under "Differential: approved changes", so they aren't reported again.
7. **Clean up:** `git worktree remove <temp folder>`, and stop both copies of the app.

## Notes

- A difference isn't automatically a bug in the new build. The old build may have been wrong. The verifier reproduces it, and the user decides through "needs you".
- This is also the history oracle that `policies/checkpoints.md` uses for regressions: behaviour that passed on an earlier build and now fails.
