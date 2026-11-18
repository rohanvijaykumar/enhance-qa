# The run lifecycle

The shared process the lead follows in every mode. Each mode file says which phases it uses and adds its own steps. `qa` means `node <skill>/scripts/qa.mjs` or `python <skill>/scripts/qa.py`, run from the project root.

## 0. Start

1. `qa status --json`: is there a `qa/` folder? What's the last build, the open bugs, the fixes waiting?
2. `qa ingest --json` if `qa/STATUS.md` exists. Apply the user's ticks and answers first (`formats/status.md`).
3. **Pick the mode** (SKILL.md table). If the last run's front matter says `interrupted:`, resume that run instead: same run number, same build, skip finished work.
4. **Estimate** (`policies/cost.md`) and announce the one-line scope. Above `confirm_over_usd`, ask for a one-line OK (Balanced, Guided). The user can answer "go", "lean" or "split". A non-interactive run runs the announced scope. From here on, the pass runs to the end of that scope.
5. `qa lock acquire`. If another run holds the lock, stop and say so. A lock older than 6 hours is stale and taken over.
6. `qa snapshot --json` gives the build number, the snapshot commit, the branch commit (`head`) and the tree.
   - If the tree is the same as the last tested build, it's the same build. Say so, and only run what the mode needs: pending verifications, new questions answered, the user's explicit request.
   - List uncommitted files that the snapshot included.
7. `qa next-id run` gives the run number. Write the run file's front matter and a "Scope" section now, so an interruption can resume.
8. **Checks edited together with the code they judge.** A change must not rewrite the check that grades it.
   - Compare `qa/checklist/` with the last tested build's branch commit: `git diff <last head> -- qa/checklist`, plus uncommitted edits.
   - If a check's Steps or Expect changed in the same commit as product code under its area's `Paths`, or in the same set of uncommitted edits, and its `Source` records no user decision for it:
     - test it against its previous expectation;
     - add a "needs you" line: "CART-003's expected result changed together with cart code in 4f3a2c1. Is the new behaviour intended?"
   - The user's own edits made on their own are normal. Don't flag those.

## 1. Intake gate

1. **Deterministic checks first**, cheapest first: the build or install command, the project's test suite, type checks, linter, validators, and the platform's scanners where present.
   - Record each as an `auto` result.
   - A pre-existing failure that's also on the last tested build is the baseline, not a new bug.
2. **Smoke checks** (`Tags: smoke`): one fast-tier tester, the smoke matrix cell only.
3. **If the smoke test fails, reject the build.**
   - File or reopen an S1 for the blocker.
   - Write the run file (verdict: "Build rejected: <reason>").
   - Stop, unless the mode is `fix`/`loop` or the user allowed fixing the blocker. Then fix it first and start the pass again on the new build.

## 2. Scope

- `qa select --json` for `check`: smoke, fixes to verify, checks in changed areas, regression checks for recently fixed bugs, rotation, and any unmapped changed files.
  - Unmapped files mean new or moved code. Send them to the scout to add or extend an area (`roles/scout.md`, "Adding checks").
  - If `wide: true`, suggest a `full` pass in the announcement.
- `full`: every non-retired check, plus one exploratory charter per area.
- `release`: everything in `full`, plus the gate packs in the plan.
- **Order by risk** (high first), so if the platform interrupts the session, the most important checks are already done.
- **Human, device and gate checks** never go to agents. Prepare them with exact steps and add them to the run's "Human checks" list (`human-pending`).
- **Split agent checks into tester batches:**
  - one batch per area, or per small group of areas;
  - about `checks_per_tester` checks per batch (default 15);
  - **group checks that share setup** (the same screen, input file, account or settings) and order them so each starts from the state the last one left, where the checks allow it. Setting up once per batch instead of once per check is the biggest time saver on slow apps;
  - `parallel_testers` batches at a time, one lane each, with the next batch starting as soon as one finishes, until every batch is done. Use more lanes when the machine can run another copy of the app (`policies/cost.md`);
  - scripted and one-screen checks go to the fast tier; multi-step flows and charters to the balanced tier;
  - testers use the prepared fixtures (`qa/evidence/fixtures/`, listed in the notes) instead of fetching or generating their own inputs.

## 3. Test

1. `qa hash --record` fingerprints the checklist.
2. `qa phase start --role tester --run <n>`.
3. **Spawn the testers in parallel and wait for all of them** (`platforms/<platform>.md`). Each gets:
   - the role prompt (`roles/tester.md`);
   - the build number;
   - its checks, as their full text from the area files;
   - its slice of `qa/notes.md`;
   - the driver section of the relevant platform module;
   - the evidence folder `qa/evidence/<run>/`;
   - its notes file `qa/runs/<run>/tester-<k>.md`.
4. `qa gate --role tester` reverts anything outside the allowed files, and fails on checklist changes.
5. `qa results merge <run>`.
6. **Pace check, after the first round of batches:**
   - Re-estimate the time and cost left from the measured pace: checks per tester-hour on this app, not the starting figures.
   - **If the rest will take more than about 1.5× what was announced,** say so in one message with the new estimate. In an interactive run, offer:
     - "keep going": every announced check runs;
     - "high-risk first": the high-risk checks now, the rest saved for the next run, which resumes them;
     - "stop after this round": report what's done, and the next run resumes.
   - Waiting for the answer doesn't stop the testers already running.
   - A non-interactive run, or no answer, keeps going.
   - Record the new estimate and the choice in the run file.
7. **Spot audit** (`check`, `full`): re-run about 10% of passes (at least one) with a different tester. Investigate any disagreement (`policies/signal.md`).

## 4. Confirm candidates

1. Collect the candidates from the tester notes. Group them by likely root cause. Drop:
   - ones that match "Don't report" in the notes;
   - anything that isn't a bug: a missing feature, a wish, a number the product never promised (`policies/signal.md`, "Bugs, not wishes"). Count the drops for the Signal line.
2. `qa phase start --role verifier`.
3. **Spawn fresh verifiers** (`roles/verifier.md`) with neutral briefs: for each candidate, only the steps, the expected result and its source. Never the tester's theory.
   - One verifier per area's candidates, several areas in parallel.
   - Deterministic failures need only one clean reproduction.
4. `qa gate --role verifier`.
5. For each candidate:
   - **Reproduced** (2 of 3, or once for a severe one): `qa bug new …`, then fill in the sections. Status `open`, `repro` as measured, with the check's result linked.
   - **Not reproduced:** note it in the run file. Mark the check `flaky` if results were mixed; otherwise record "not reproduced" and file nothing.
   - **Not a bug:** drop it, count it on the Signal line, and file nothing. If the check itself expected a feature the product doesn't have, mark the check `Retired: <date> tested a feature the product doesn't have`.

## 5. Triage

- **Confirm severity** (`policies/severity.md`) and set the priority from the stage's bug bar.
- **Group duplicates:** `duplicate`, with `duplicate_of`.
- **New or pre-existing?** In `check` and after-change runs, tag a bug `pre-existing` when the problem was already there before this change:
  - its check failed on the last tested build too;
  - or the code it depends on didn't change since then.

  The summary keeps these apart from what the change introduced, so the user's coding agent isn't sent after old problems as if it caused them.
- **Class:** give each bug a `class:` naming the kind of mistake, when it's clear from the evidence. The fixer refines it from the cause.
- **Judgement calls** (bug or by design? a behaviour change?) get `needs-decision` and a "Needs you" line (`policies/checkpoints.md`).
- **The fix list:**
  - `fix-now` bugs that are clear defects, or that the user approved;
  - severity first, then grouped by area;
  - worked in batches of `fixes_per_batch` (default 20), each batch verified before the next, until the list is done.

## 6. Fix

Only in modes that fix (`fix`, `loop`, `check` or `full` when autonomy allows, or the user asked), and only for bugs the verifier reproduced. See `policies/fixing.md`.

In a test pass, `fix_during_run` limits this phase: by default only S1–S2 clear defects. The rest are listed, each with its prompt, for `/enhance-qa fix` or the user's own agent. The summary says so ("Fixed: 3 serious bugs. 14 more are ready to fix: `/enhance-qa fix`").

1. **Checkpoint commit question:** asked once, then remembered as `checkpoint_commit:`.
2. `qa phase start --role fixer`.
3. **Spawn the fixer** (`roles/fixer.md`) with the bug files, in order. The fixer commits one bug at a time and writes its fix notes.
   - Clear one-file defects go to a balanced-tier fixer, batched by area.
   - Security, auth, data and payment bugs, multi-file fixes and second attempts go to a strong-tier fixer.
4. `qa gate --role fixer` fails on any edit to the checklist, the plan or other bugs' fields.
5. **Status:** `fixed`, with `fixed_in` set to the commit. Copy the fixer's `Class:` line into the bug's `class:`.
6. **Siblings:** candidates the fixer reports (the same mistake somewhere else) go to the verifier in phase 7, with neutral briefs like any candidate. Reproduced ones are filed and join the fix list.
7. **Stop fixing for this run** after two reverts in a row; testing and reporting still finish.

## 7. Verify fixes

1. `qa snapshot` gives the new build that includes the fixes.
2. `qa phase start --role verifier`.
3. **Spawn a fresh verifier,** never the one that reproduced these bugs if a fresh one is available. For each fixed bug it gets:
   - the original steps and expected result;
   - the fix's "halo" from the fix notes, as checks to run;
   - `qa tamper-tests --since <old build>` output to review.
4. `qa gate --role verifier`.
5. **Copy each log line** into its bug: `qa bug log <BUG> --from qa/runs/<run>/verifier-<k>.md`.
6. **Verdicts:**
   - **Verified:** `verified` and `verified_in`. Then add a regression check to the checklist (`Tags: regression`, `Source: BUG-NNN`, `qa next-id check <AREA>`).
   - **Not verified:** `reopened` and `attempts` + 1. At 2 attempts, `needs-decision`.
   - **Inconclusive:** re-run once. Then `needs-decision`.

## 8. Report

1. **Finish the run file** (`formats/runs.md`):
   - results (merged), bugs, exploratory notes;
   - signal (share of findings acted on), cost ledger;
   - "Needs you", "Not covered" and the verdict.
2. **Merge the testers' "Learned" lines into `qa/notes.md`.** Keep it short; drop duplicates.
3. **Propose lessons** (`policies/lessons.md`): two or more bugs with the same `class:`, or an escaped bug that shows a gap, become a proposed rule for the coding agent. That can be a lint rule, a `verify` step, or one line in CLAUDE.md or AGENTS.md. Add each to "Needs you" and to `qa/lessons.md`.
4. `qa coverage`, then `qa status --write`.
5. `qa validate`. Fix any format problems you introduced.
6. **Stop anything you started:** dev servers, emulators, browsers, background watchers. Leave alone anything that was already running when the run began.
7. `qa phase end`, then `qa lock release`.
8. **Give the user the summary block** (SKILL.md). It names only new bugs at S3 or above, the verdict, the needs-you items, and the paths. Bugs tagged `pre-existing` go on their own line ("Also found, already there before this change: …"), not under "New".

## Finishing what was started

- **A pass runs to the end of its announced scope.** Two things can end it early:
  - the user's own choice at the pace check;
  - `max_usd_per_run`, when the user has set it (`policies/cost.md`).

  Either way the next run resumes what's left.
- **An agent that reaches its turn budget** (`agent_turns`) writes its notes. Start a fresh agent with:
  - the same role and brief;
  - the checks it didn't reach, by ID. Re-run any check it left half-done from the start;
  - its "Learned" lines.

  For the fixer, the boundary is a bug: it undoes any unfinished bug's uncommitted changes, and the next fixer restarts that bug (`policies/cost.md`, "Handovers between agents").
- **Spending well over the estimate** (about 1.5×) switches the remaining work to cheaper ways of doing the same checks (`policies/cost.md`, "Adapting instead of stopping"). It never skips them. Record the switch in the run file.
- **Save progress after every phase and every tester batch:** results merged into the run file, plus a `progress:` line in its front matter saying what's done and what's left. If the platform stops the session (a usage limit, a full context, the app closed), nothing is lost. The next `/enhance-qa`, or "continue", resumes from the run file.
- **If your own context is getting full,** write the run file with `interrupted: <phase, what's left>` before anything else, then continue. If the session ends, the next run resumes from it.
- **`max_usd_per_run` reached** (only when the user set it): finish the current check, write `interrupted: spending limit reached; resume to finish`, and tell the user how much is left. The next run resumes the same pass; it doesn't start over.
- **A role that fails or returns nothing useful** is retried once with a fresh agent and the same brief. If it fails again, record the checks as `blocked` with the reason, and say so in the summary. Never retry silently.

## Without subagents

Run the same phases yourself, one role at a time, keeping each role's rules (`platforms/other-agents.md`). The verifier must still run as a separate headless process where one is available. Say in the run file when the separation was weaker.
