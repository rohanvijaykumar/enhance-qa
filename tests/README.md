# Tests

## Script parity

`scripts/qa.py` and `scripts/qa.mjs` must behave identically. One 79-step scenario runs against both in fresh temporary git repos and compares every exit code, output and key file:

```bash
python -I tests/scripts/parity_test.py
```

It ends with `parity: OK (0 differing step(s))` and `0 expectation failure(s)` for both. Run it after any change to either script.

## Bug zoo

Small sample apps with known bugs planted in them, used to measure the skill end to end: bugs found against bugs planted, false alarms, time and cost.

| App | Set | What it is | Planted bugs |
|---|---|---|---|
| `bug-zoo/web-shop/` | tuning | A small Node web shop (no dependencies), with accounts, a cart, checkout, orders and an admin page | 13 (security, auth, cart, content, layout, "looks done but isn't") |
| `bug-zoo/cli-csvstat/` | held-out | A Python CLI that summarises a CSV column | 7 (wrong maths, exit codes, stderr, options, encodings, crashes, version) |
| `bug-zoo/cli-wordcount/` | control | A small, carefully written `wc`-like CLI whose README is the exact spec | none: every filing is a possible false alarm |

**The sets keep the measurement honest:**
- **Tuning:** the app may be used while changing the skill: read its transcripts, adjust prompts, re-run.
- **Held-out:** don't read its transcripts or tune on its results. Score it only to check that a change generalises. Once you've tuned on it, it's no longer held out: add a new held-out app.
- **Control:** nothing is planted, so its filings measure over-flagging.

The answer keys are in `bug-zoo/answers/`. The runner copies an app to a fresh folder outside the repo, strips the `BUG(...)` comments, installs the skill as a project skill, runs Claude Code headless, then scores the filed bugs against the key:

```bash
python -I tests/bug-zoo/run_zoo.py prepare --app web-shop --work <empty folder outside the repo>
python -I tests/bug-zoo/run_zoo.py run --work <folder> --prompt "/enhance-qa setup. This is a non-interactive test run: go with your kickoff defaults. …" [--node-path <dir with playwright>]
python -I tests/bug-zoo/run_zoo.py score --app web-shop --work <folder> --out tests/bug-zoo/results/<name>.md
```

**Several trials.** Model runs vary, so one run can't tell a real improvement from noise. Run the same prompt on fresh copies, then score them together:

```bash
python -I tests/bug-zoo/run_zoo.py trials --app web-shop --base <empty folder> --n 3 --prompt "…"
python -I tests/bug-zoo/run_zoo.py score --app web-shop --work <base>/t1,<base>/t2,<base>/t3 --review tests/bug-zoo/results/<name>.review.json --out tests/bug-zoo/results/<name>.md
```

**What the score shows:**
- **Per planted bug,** how far it got in each trial: noticed by a tester, confirmed and filed, fixed and verified. It also says where it got lost.
- **"Found at least once"** (pass@k) and **"found every time"** (pass^k). The second is the one that matters for a tool people rely on.
- **Precision:** filings that match no planted bug are listed for review. Record a verdict for each in a review file, `{"<exact title>": "real"}` or `{"t2:BUG-014": "false-alarm"}`. Then the score counts false alarms instead of leaving them to memory.
- **Process and cleanliness:** each run's `progress:` line, and any stray files the run left outside `qa/`.

**Cost and caveats:**
- **Cost:** a run spends real model usage, about $5–10 API-equivalent for a setup pass with fixing. Three trials cost three times that.
- **Scoring:** a keyword match, so read the "matched" table and the unmatched filings by hand. Most unmatched filings so far were real bugs that weren't planted.

Results so far are in `bug-zoo/results/`. They were single runs, made before the trials and sets above existed.

## Trigger tests

Does the skill start when it should, and stay quiet when it shouldn't? `triggers/prompts.csv` lists 16 prompts:
- **9 that should start it:** explicit (`/enhance-qa`), plain English ("QA my app", "is this ready to ship?") and indirect;
- **7 that shouldn't:** a unit test, a diff review, a linter run, explaining code, a typo, a new feature, a general question.

Each runs in a fresh copy of the control app, for a few turns, with read-only tools:

```bash
python -I tests/triggers/run_triggers.py --work <empty folder outside the repo> [--model sonnet] [--only qa-my-app,unit-test] [--max-turns 8] [--clean]
```

**What it prints:** one line per prompt, saying whether the skill started and how many other tool calls came first ("first" is the goal). Then a summary. It costs a few cents per prompt.

**How a start is detected:**
- a `Skill` call naming enhance-qa;
- or the skill's own actions: reading its files, or running its scripts. A slash command loads the skill without leaving an event.

**`--clean`:** loads only project settings, leaving out your own plugins. Their skills compete for Claude Code's skill-listing budget, which drops the descriptions of rarely used skills first, and a new skill counts as rarely used. Run both ways: with `--clean` for how the skill does on a fresh machine, and without for how it does next to many other skills.

**`--with-note`:** writes the coding-agent note that setup offers into CLAUDE.md and AGENTS.md, like a project that has been through setup.

Add a row whenever the skill starts, or fails to start, on a real request. Results so far are in `triggers/results/`. Codex isn't covered yet: `codex exec --json` needs its own event parser.
