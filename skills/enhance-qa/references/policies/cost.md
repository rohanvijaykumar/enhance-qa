# Cost and speed

**A pass that starts, finishes.** Cost is controlled by deciding what to test before the pass starts, and by testing efficiently, never by cutting a pass short behind the user's back. Limits on individual agents hand their remaining work to a fresh agent; they don't end the pass.

Only the user can end a pass early, and the next run resumes what's left instead of losing it. They can do it two ways:
- at the pace check, when a pass is running well over its estimate;
- with a spending limit they set themselves (`max_usd_per_run`, off by default).

Four things drive an agent QA bill:
- the number of turns;
- the size of each observation (a page snapshot, a screenshot, a log), which is re-read on every later turn;
- output and thinking tokens;
- cache misses.

So attack turns and observation size first. Model choice comes second.

## The levers, biggest first

1. **Intake gate.** Run the smoke test first. If it fails, reject the build: there's nothing useful to test on a build that doesn't start. The summary gives the error.
2. **Choose the scope before starting.** `qa select` picks the smoke checks, the fixed bugs, the checks around the diff and a small rotation. Full passes run at baseline, milestones, wide changes and the release candidate. This is the main cost control, and it's decided and announced up front.
3. **Deterministic first.** The project's tests, type checks, linters, validators, platform scanners and replayed scripts cost no tokens. Run them before any agent, and don't duplicate what they already cover.
4. **Cheap observation.** These rules go into every tester prompt:
   - prefer interactive-only or element-scoped accessibility trees, and `find` or grep, over full page dumps;
   - act on a batch of steps, then observe once;
   - keep snapshots in files and diff them instead of re-reading them;
   - take screenshots only for visual checks, at 1280×800 or less, cropped to the region;
   - truncate logs to the relevant lines.
5. **Route models by role,** and judge them by cost per correctly judged check, not price per token.
6. **Small, fresh testers.**
   - One per batch of about 15 checks, with a tight brief and its slice of `qa/notes.md`.
   - Each returns only verdicts and evidence paths.
   - A tester that reaches its turn budget (`agent_turns`) writes its notes, and the lead starts a fresh tester for the checks it didn't reach. Short contexts are cheaper than one long one.
   - Keep fast-tier sessions under about 100K tokens, because some providers raise the price of the whole request above that.
7. **Cache-friendly.** Give each role identical instructions, tools, model and effort, so sibling agents reuse the cached prefix. Put the role prompt first and the per-check brief last. Never toggle MCP servers or plugins mid-run.
8. **Remember the app.** `qa/notes.md` holds the app map (screens, routes, stable element references, login steps, known waits), so no tester rediscovers it. Testers report what they learn, and the lead merges it into the notes.
9. **Record once, replay free.** Stable, frequently run checks become scripts in the project's test runner (`references/integrations/replay.md`). A failing replay triggers an agent re-check before anything is filed, because generated tests flake.
10. **Lean bookkeeping.** The lead reads summaries, never full transcripts. Status, IDs, coverage and diff selection come from `qa` scripts.
11. **Estimate up front, adapt instead of stopping** (below).
12. **A cost ledger.** Each run file records tokens and approximate cost per role, from subagent usage reports and JSON output, so estimates calibrate to this app. Subscribers see percentages of their limits where the platform reports them.

## Model tiers

| Tier | Claude Code | Codex | Used for |
|---|---|---|---|
| fast | `haiku` | `gpt-6-luna` | scripted and replayed checks, simple one-screen checks, triage of tool output |
| balanced | `sonnet` | `gpt-6.1-sol` (or `gpt-6.1-terra`, cheaper) | multi-step flows, exploratory sessions, verification |
| strong | the session's model (`inherit`) | the session's model | scout (planning); fixes to security, auth, data or payments, multi-file fixes and second attempts |

Clear one-file defects go to the balanced tier, batched by area. In the first bug-zoo run, 17 fixes on the strong tier were most of a $9.60 run, while the fast-tier testers cost $0.05 in total.

These are the defaults as of 16 Nov 2026. In `qa/plan.md`, `model_fast`, `model_balanced` and `model_strong` override them; `default` means this table. Small models can need more turns on complex flows, so don't put multi-step exploratory work on the fast tier.

## Budget presets

The preset sets how much a pass covers and how it routes models, decided before the pass starts. It never truncates a pass that's running.

| Preset | Scope | Models | Evidence |
|---|---|---|---|
| `lean` | Smoke and changed areas only; no rotation; no exploratory sessions | fast tier for testers; balanced for the verifier | text evidence; screenshots only for failures |
| `standard` (default) | As the mode says | default routing | screenshots for visual checks and failures |
| `thorough` | Mode scope plus a 25% rotation and an exploratory session per changed area | balanced for all testers | screenshots for every UI check |

## Estimate, confirm, then finish

1. **Before a pass,** estimate it and announce one line: scope, time and cost.
2. **If the estimate is above `confirm_over_usd`** (default $2), ask for a one-line OK first on Balanced and Guided. Autopilot, `confirm_over_usd: never` and non-interactive runs don't ask; they run the announced scope.
   - The OK is the moment to choose: "go", "lean" (a smaller scope) or "split" (run the highest-risk half now and the rest next time).
   - If the user says nothing in a non-interactive run, the announced scope runs.
3. **Once it starts, the pass runs to the end of its announced scope.**
4. **Pace check after the first round of batches** (`workflow.md`, phase 3). Re-estimate from the measured pace. If the rest will take more than about 1.5× what was announced, tell the user the new estimate, and in an interactive run offer three choices: "keep going", "high-risk first" (the rest resumes next run) or "stop after this round". Without an answer, it keeps going.

**Be honest up front.** Slow apps can take far longer than the starting figures suggest. A full pass of every function on a desktop app that processes media can take several hours. Say so in the kickoff and the announcement, and offer "split": spread the pass over several runs, highest risk first.

## Settings

In `qa/plan.md`. None of these ends a pass early, except `max_usd_per_run` when the user sets it. The user's own choice at the pace check can end it early too.

| Setting | Default | Meaning |
|---|---|---|
| `confirm_over_usd` | 2 | Estimates above this ask for a one-line OK before starting (Balanced, Guided). `never` turns it off |
| `parallel_testers` | 3 | Testers working at the same time, one lane and one copy of the app each. The lead may go up to 5 when the machine has the memory and CPU for more copies: check free memory before starting each extra one. More is faster, but uses usage limits faster. Apps that allow only one copy get lane copies with their own identity (`platforms/drivers.md`, "Several copies at once") |
| `fix_during_run` | `serious` | How much a test pass fixes: `serious` (S1–S2), `clear` (every clear defect at the stage's bar) or `none`. `fix` and `loop` fix everything eligible (`fixing.md`) |
| `checks_per_tester` | 15 | Batch size. Smaller batches mean smaller, cheaper contexts |
| `agent_turns` | 40 | Turns per tester or verifier before it writes its notes and hands its remaining work to a fresh agent. Fixers get twice this and the scout three times, because their jobs are longer. Never ends the pass |
| `fixes_per_batch` | 20 | The most bugs one fix round takes: one build, one verification (`fixing.md`, "Fix rounds"). A longer list is split into batches, each verified before the next, until every eligible bug is done |
| `max_loop_rounds` | 3 | For `loop` only. After this many rounds the loop steps back and reports what's left, instead of re-finding old problems (`modes/loop.md`) |
| `max_usd_per_run` | (empty: no limit) | **Opt-in hard limit.** When set and reached, the lead finishes the current check, saves the run as `interrupted`, and the next `/enhance-qa` resumes exactly where it stopped. Where the platform supports a budget flag (`claude -p --max-budget-usd`), use it with the same value |

## Handovers between agents

A handover only ever happens at a clean boundary, so it costs a little re-reading and nothing else:
- **Testers and verifiers hand over between checks.** Checks are independent and each starts from a stated state. A check that was cut off midway is re-run from the start by the next agent, never continued.
- **State is in files, not in the agent.**
  - Results are written to the agent's notes file as it goes.
  - App knowledge is in `qa/notes.md`.
  - The next agent gets the same brief, the remaining checks by ID, and the previous agent's "Learned" lines.
  - The lead tracks progress by check ID, so nothing is skipped or run twice.
- **The app stays running** between agents. The lead starts it once per run, so a new agent doesn't restart it unless a check needs that.
- **The fixer hands over between bugs, never in the middle of one.** Finished bugs are already committed one by one. If it runs out of turns mid-bug, it first undoes its uncommitted changes for that bug, and the next fixer restarts that bug cleanly.
- **The scout writes area files one at a time.** A fresh scout continues with the areas the last one listed as left.
- **Exploratory charters are time-boxed to fit inside one agent.** If one is cut short, its notes say what was covered, and a follow-up charter covers the rest.

Fresh agents also suit the design: they're independent, and they don't carry the previous agent's assumptions.

## Adapting instead of stopping

The lead compares spending with the estimate after each phase. When a pass is running well over its estimate (about 1.5×), it switches the remaining work to cheaper ways of doing the same checks:
- the fast tier for scripted and one-screen checks that were on the balanced tier;
- text evidence instead of screenshots, except for visual checks and failures;
- replays for checks that have them;
- one variant instead of several for low-risk verifications;
- smaller tester batches.

It records the switch and the reason in the run file, finishes the pass, and recalibrates the estimate for next time. It never skips announced checks to save money.

## Limits the skill can't control

The platform can stop a session: a subscription usage limit, the context window, a crash, the user closing the app. The skill makes these harmless:
- **Progress is saved after every phase and every tester batch.** The run file records what's done and what's left.
- **Running `/enhance-qa` again, or saying "continue", resumes** the same build's pass where it stopped, rather than starting over. The report marks the interruption.
- **Small, fresh agents** keep each context well below the window, and the lead hands off its own work to files before its context fills.

## Safety stops are not cost caps

These protect the user's code and stop one activity, never the pass:
- two failed fix attempts on a bug make it `needs-decision`, and the fixer moves on to the next bug;
- two reverts in a row stop fixing for this run, but testing and reporting still finish;
- a `loop` that stops converging ends with a clear report (`modes/loop.md`).

## Estimating

- **Starting figures per check:** fast about $0.004; balanced about $0.06; strong about $0.12.
- **Overheads:** add 40% for the lead and verifier, and about $0.25 per exploratory session at balanced.
- **Calibration:** once two runs exist, `qa select` uses the average cost per check from the run files instead.
- **Time per agent check, before calibration:**
  - web apps, CLIs and APIs: about 1–2 minutes;
  - desktop and mobile apps: about 3–5 minutes;
  - apps that process media or run long jobs: about 5–10 minutes.

  Divide by the number of lanes and add 2 minutes of overhead. On a desktop media app, a full pass measured about 4–5 agent turns and about $0.25 per check.
- **Re-estimate after the first round of batches** from the measured pace (the pace check).

## Speed

- Testers work in parallel (`parallel_testers`, default 3, up to 5 when the machine allows).
- **Apps that allow only one copy still run in parallel.** Each lane gets a copy with its own identity: its own profile folder, or a lane build with its own app ID, made without touching the product's files (`platforms/drivers.md`, "Several copies at once"). Building lanes takes minutes; a real desktop pass that fell back to one lane took almost 7 hours.
- **Checks that share setup run together,** in an order where each starts from the state the last one left. Setting up once per batch, not once per check, is the biggest saving on slow apps.
- **Prepared fixtures** (`qa/evidence/fixtures/`) replace live downloads and generated inputs: a few seconds of media instead of a full video.
- **Verifiers work by area, in parallel.** Deterministic failures need one clean reproduction, not three.
- **Fixing waits** in a test pass except for serious bugs (`fix_during_run`), so testing isn't held up by fix-and-verify rounds.
- **Fix rounds stay few and lean:** everything approved in one round, one build, verifiers by area in parallel, and a halo limited to the code the fixes changed (`qa select --halo`). Minor bugs left after a long pass are suggested for the user's own coding agent, verified by the next `check` (`fixing.md`, "Fix rounds").
- The smoke test runs first, so a broken build fails in about a minute.
- A typical `check` should finish in under 10 minutes.
- Long passes run in their own session, beside the user's work (`references/platforms/`).
