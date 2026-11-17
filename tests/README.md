# Tests

## Script parity

`scripts/qa.py` and `scripts/qa.mjs` must behave identically. One 79-step scenario runs against both in fresh temporary git repos and compares every exit code, output and key file:

```bash
python -I tests/scripts/parity_test.py
```

It ends with `parity: OK (0 differing step(s))` and `0 expectation failure(s)` for both. Run it after any change to either script.

## Bug zoo

Small sample apps with known bugs planted in them, used to measure the skill end to end: bugs found against bugs planted, false alarms, time and cost.

| App | What it is | Planted bugs |
|---|---|---|
| `bug-zoo/web-shop/` | A small Node web shop (no dependencies), with accounts, a cart, checkout, orders and an admin page | 13 (security, auth, cart, content, layout, "looks done but isn't") |
| `bug-zoo/cli-csvstat/` | A Python CLI that summarises a CSV column | 7 (wrong maths, exit codes, stderr, options, encodings, crashes, version) |

The answer keys are in `bug-zoo/answers/`. The runner copies an app to a fresh folder outside the repo, strips the `BUG(...)` comments, installs the skill as a project skill, runs Claude Code headless, then scores the filed bugs against the key:

```bash
python -I tests/bug-zoo/run_zoo.py prepare --app web-shop --work <empty folder outside the repo>
python -I tests/bug-zoo/run_zoo.py run --work <folder> --prompt "/enhance-qa setup. This is a non-interactive test run: go with your kickoff defaults. …" [--node-path <dir with playwright>]
python -I tests/bug-zoo/run_zoo.py score --app web-shop --work <folder> --out tests/bug-zoo/results/<name>.md
```

- **Cost:** a run spends real model usage, about $5–10 API-equivalent for a setup pass with fixing.
- **Scoring:** a keyword match, so read the "matched" table and the unmatched filings by hand. Most unmatched filings so far were real bugs that weren't planted.

Results so far are in `bug-zoo/results/`.
