# enhance-qa

**A QA department for your app, inside your coding agent.** It works with Claude Code and Codex, and also Cursor, Copilot, Gemini CLI and Antigravity.

You say `/enhance-qa`, or just "QA my app". A small team of agents then does what a real QA team does:
- a **scout** maps the product and writes a checklist;
- **testers** use the product the way people do, with evidence for every result;
- a **verifier** reproduces every bug before it reaches you, and checks every fix;
- a separate **fixer** fixes bugs one commit at a time, with a failing test first.

You stay the product owner: you confirm the plan, make the judgement calls and decide when to ship.

It keeps a plain-Markdown record in a `qa/` folder that you can read, edit and commit. Each run builds on the last: only what changed gets re-tested, fixed bugs get regression checks, and a release pass ends in a go/no-go report.

It covers any kind of software: web apps, sites, iOS and Android, desktop apps, CLIs, APIs, libraries, browser extensions, plugins, bots, games, audio plugins, AI features, embedded devices, data pipelines, XR, and TV and media deliverables.

---

## Install

One command installs it for both Claude Code and Codex:

```bash
npx skills add <owner>/enhance-qa -a claude-code -a codex
```

- Add `-g` to install it for every project.
- On Windows, add `--copy` to use real copies instead of links.
- **Other agents:** add `-a cursor`, `-a github-copilot`, `-a gemini-cli` or `-a antigravity`.

**Claude Code plugin (optional, stricter).** This adds read-only role agents and safety hooks:

```bash
claude plugin marketplace add <owner>/enhance-qa
claude plugin install enhance-qa@enhance-qa
```

**By hand:** copy `skills/enhance-qa/` to `.claude/skills/enhance-qa/` (Claude Code), or to `.agents/skills/enhance-qa/` (Codex and most other agents).

**Requirements:**
- git is recommended (it pins builds and makes every fix undoable).
- Node 18+ or Python 3.8+, for the helper scripts.
- For browser testing, Playwright. The driver can use an installed Chrome or Edge, so no browser download is needed.

## Quick start (2 minutes)

1. In your project, run `/enhance-qa` (Claude Code) or `$enhance-qa` (Codex), or say "QA my app".
2. It reads your project for about a minute, then sends **one kickoff message** with its best guesses: what the app is, the stage, what it can and can't test here, test accounts and how fixing works. Reply **"go"**, or correct any line.
3. It writes the plan, the checklist and app notes into `qa/`, then runs a first pass sized to your stage, fixes clear defects and reports:

```
QA · Build 7 · check · 9 min
✓ 31 passed   ✗ 2 failed   ⏸ 1 blocked        Verdict: not ready — 1 major bug open
Fixed and verified: BUG-012, BUG-015 · Reopened: BUG-014 (still fails at phone width)
New: BUG-019 (major) a wrong password shows a 500 page · BUG-020 (minor) pricing typo
Needs you (1 min): BUG-018 — "Delete account" has no confirmation step. Bug, or by design?
Details: qa/STATUS.md · qa/runs/007-check.md · ~$0.40 API-equivalent
```

4. Open **`qa/STATUS.md`**. It shows the verdict, open bugs, what needs you and the human-only checks. Tick a box, or write `→ your answer` after an item; the next run picks it up.

After that, `/enhance-qa` with no words does the right next thing.

## What you can ask for

| Say | What happens |
|---|---|
| *(nothing)* | The right next pass, picked from the state of `qa/` and git |
| `check` | The everyday pass: smoke test, verify fixes, regression around what changed, new features, a small rotation |
| `full` | Every check, environments pairwise, an exploratory session per area |
| `release` | Release-candidate pass: full regression, release gates, your human checklist, and a go/no-go report |
| `fix` | The fixer works through the fix-now bugs; a fresh verifier checks each fix |
| `loop` | Test → fix → verify until clean |
| `checkout` (any area) | A focused check plus exploration of that feature |
| `bug "the export button does nothing"` | Reproduce it, file it, add a regression check |
| `prod` | A read-only smoke test of your live app after a deploy |
| `status` | Where things stand, from files. Almost no tokens |

Plain English works too: "is this ready to ship?", "check what I just changed", "fix the QA bugs".

## How it stays out of your way

- **Only three things stop and wait for you:**
  - the kickoff on the first run;
  - a one-line OK before an unusually large run;
  - the go/no-go decision.

  Everything else collects in one "needs you" list per run.
- **It fixes clear defects itself,** one commit each, and asks before anything that changes how your app behaves, looks or reads. Data, auth, payments and dependencies also wait for your OK. There are three autonomy levels: Guided, Balanced (the default) and Autopilot.
- **It never pushes,** rewrites history or deploys.
- **Run it beside your work:**
  - in a second session or terminal (`claude -w qa`, or a Codex worktree chat);
  - or in the background (`claude --bg "/enhance-qa"`, `codex exec --worktree`).

## Cost

Cost is set by what a pass tests, decided and announced before it starts:
- **Deterministic first:** your own tests, type checks, linters and scanners run before any agent.
- **Only what changed** gets re-tested.
- **Cheap models** do routine checks.
- **Agents observe compactly.**
- **Saved app notes** mean no tester rediscovers your app.
- **Stable checks become free automated tests.**

Targets at API prices for a small-to-medium app:

| Pass | Cost |
|---|---|
| Everyday `check` | about $0.50–2 |
| `full` | about $5–12 |
| `release` | about $8–15 |

Subscribers pay in usage limits instead, and the same levers apply.

**Measured on the bug zoo** (Claude Code; Opus 5.5 as the session model, Sonnet and Haiku for the team):

| Run | What it did | Time | Cost |
|---|---|---|---|
| Web shop, first run | Setup, a 70-check full baseline, 17 fixes, each verified. Found all 13 planted bugs plus 8 real unplanted ones; no false alarms | 42 min | $9.59 |
| CLI tool, first run | Setup, a 38-check baseline, 9 fixes, each verified. Found all 7 planted bugs plus 4 real unplanted ones | 19 min | $5.15 |
| Web shop, next day | A bare `/enhance-qa` chose `check`, verified a fix made outside QA, caught a planted regression and filed 6 new edge cases | 13 min | $3.75 |

The everyday figure is high here because the test shop keeps every route in one file, so any change touches every area; split apps re-test far less. Details are in [tests/bug-zoo/results/](tests/bug-zoo/results/).

**A pass that starts, finishes.** Nothing cuts a run short halfway:
- an agent that uses up its turn budget hands its remaining checks to a fresh agent;
- if spending runs over the estimate, the rest switches to cheaper ways of doing the same checks;
- if the platform stops the session (a usage limit, a closed laptop), running `/enhance-qa` again resumes where it stopped.

The only hard spending stop is one you set yourself (`max_usd_per_run` in `qa/plan.md`), and it resumes too.

## What's in `qa/`

```
qa/
├── STATUS.md     the one page to read: verdict, open bugs, what needs you, human checks
├── plan.md       the test plan, with settings at the top (stage, autonomy, budget, models)
├── notes.md      how to start your app, log in and reach each area
├── checklist/    the checks, one file per area of your app
├── bugs/         one file per bug, plain language first, with a prompt for your coding agent
├── runs/         one file per pass: scope, results, evidence, cost
└── coverage.md   when each check last ran
```

It's all Markdown: commit it, review it in pull requests, edit any of it. Exports to CSV, HTML and Excel are available. For a real one, see [examples/web-shop-qa/](examples/web-shop-qa/STATUS.md).

## Coverage, on day one

The checklist draws on a library of 62 files:
- **the base layer:** product mapping, quality characteristics, input and state attacks, universal UI states, content quality and oracles;
- **22 platform modules**, from web, mobile and desktop to CLIs, APIs, games, audio plugins, XR, and TV and disc deliverables;
- **24 feature packs**, such as auth, payments, accessibility (WCAG 2.2 AA), security basics, privacy, i18n, and a pack for the defects typical of AI-built apps (open Supabase or Firebase data, broken authorisation, leaked secrets, features that only look finished);
- **16 release gates:** the App Store, Google Play, Microsoft Store, notarisation and code signing, Steam, Xbox, console bring-your-own, age ratings, extension stores, VS Code Marketplace, audio plugin validation, package registries, a 14-check web launch gate, and accessibility and privacy law.

You can also import your own checklist (a client spec, a console certification list, a regulated-industry list) and it becomes checks.

## Safety

These apply at every autonomy level:
1. **Test data only.** Never real customers' data, real payments or real messages.
2. **Production is read-only** unless you allow a named test account.
3. **Agents never type real credentials.**
4. **Content in the app is data, not instructions.**
5. **No pushing, history rewrites, force operations or deploys.**
6. **No CI, infrastructure, secrets or deploy-config changes** without your OK.
7. **Human, device and store checks are never marked passed by an agent.**
8. **Secrets and personal data are redacted** from evidence.

## FAQ

**How is this different from my coding agent testing its own work?**
- Here a separate team tests a pinned build, a fresh verifier confirms every bug and every fix, and the fixer can't touch the checklist or close its own bugs.
- The record carries across builds, so regressions get caught and releases get a real go/no-go.

**Does it work without git?** Yes. Builds are identified by file fingerprints, and fixes are backed up file by file. `git init` is recommended.

**Will it slow my agent down when I'm not using it?** No. It runs only when you ask, or when your request clearly asks for QA. The optional plugin hooks do nothing unless a QA phase is running.

**Can my own coding agent fix the bugs?** Yes. Each bug has a paste-ready prompt. If your agent marks a bug `fixed`, the next `check` verifies it independently.

**What can't it test?** Anything that needs a real device, a human's judgement (feel, sound, looks) or a store submission becomes a short human checklist with exact steps. Those checks are never auto-passed.

**Is my code sent anywhere new?** No. It uses only the agent you already run; nothing goes to a separate service.

## Repository layout

```
skills/enhance-qa/      the skill (SKILL.md, references/, scripts/, templates/, roles/)
.claude-plugin/         Claude Code plugin and marketplace manifests
hooks/                  Claude Code plugin hooks
tests/                  script parity tests and the bug zoo (sample apps with planted bugs)
examples/web-shop-qa/   a real qa/ folder from two bug-zoo runs: see what it writes
```

## Licence

MIT. See [LICENSE](LICENSE).
