# Record once, replay free

Stable, frequently run checks become automated tests in the project's own test runner, so later runs cost no tokens for them.
- **On by default** when the project already has a runner.
- **Otherwise offered at kickoff,** because it adds a dev dependency.
- **Setting:** `replay: on|off` in `qa/plan.md`.

## Which checks get a replay

A check qualifies when all of these hold:
- it passed on its last two runs;
- it isn't `human`, `device`, `gate` or `exploratory`;
- its steps don't depend on outside services without a sandbox;
- it runs at least every few passes: smoke, regression, or high-risk checks in active areas.

Regression checks from verified bugs are the first candidates, because they protect fixes.

## How

1. **Use the project's runner,** in its style and location:
   - web: Playwright Test (`tests/qa/` or the project's e2e folder); Cypress if the project already uses it;
   - Node: Vitest or Jest;
   - Python: pytest;
   - Rust: `cargo test`;
   - mobile: the existing Detox, Maestro or `integration_test` setup;
   - CLIs: shell or pytest with subprocess.
2. **Name the test after the check** (`CART-004 removing the last item shows the empty cart`). Add the path to the check: `Replay: tests/qa/cart.spec.ts`.
3. **Assert the end state, not the toast:** the stored record, the response body, the file on disk.
4. **The replay inherits the check's Expect exactly.** If the test needs a different expectation, the check is wrong or the product changed. Ask; don't adjust the test to pass.
5. **Where present, use Playwright's own planner, generator and healer agents** for web tests, but review their output against the check before keeping it.

## Running replays

- In the intake gate and in scope selection, a check with a `Replay` runs its script instead of an agent. The result goes in the run file as `auto`, with the test report as evidence.
- **A failing replay triggers an agent re-check** of the same check before anything is filed. Generated tests are flaky: Slack measured 8–48% false failures.
- **If the agent passes it,** mark the replay `flaky`. The fixer, or the user's agent, then looks for the cause (timing, test data, environment) and repairs the test. A repair never adds sleeps, longer timeouts or retries, because those hide real races.
- **A flaky replay with no cause found by the next pass is retired:** `Replay:` is removed and the reason written in the check (`Replay retired: <date> <reason>`) and in the run file. The check goes back to agents. A test that keeps failing for no reason teaches everyone to ignore failures, which is worse than no test.

## Who writes replays

The scout writes them for qualifying checks during setup and after `full` passes. The fixer writes the regression test for each bug it fixes, as part of the fix. Both are reviewed by the verifier for tampering like any other test change.
