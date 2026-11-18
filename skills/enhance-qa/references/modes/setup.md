# Mode: setup

**When:** there's no `qa/` folder (or the user asks to set up again). This is the only mode with a blocking kickoff.

## 1. Recon (about a minute)

Spawn the scout for Job 1 (`roles/scout.md`), or do a light version yourself for a small repo:
- README and docs; code layout; package and build files; frameworks;
- existing tests and CI; deploy config; seed data and `.env.example`;
- drivers that work on this machine, and whether the agent can see images;
- stage signals; matching coverage modules, feature packs and gates.

**Not a git repo?** Recommend `git init` in the kickoff. It pins builds and makes every fix undoable. Without git, everything still works, but builds are identified by timestamp, impact analysis asks the user what changed, and fixes are backed up file by file.

## 2. Kickoff message (wait for the reply)

One message, with your best guesses filled in, so the user can reply "go". Number the lines, so they can correct by number. Keep it under about 15 lines. Adapt the lines to the product; leave out any that don't apply.

```
Before I start, here's what I found. Reply "go", or correct any line.
1. What it is: a recipe-sharing web app (Next.js + Supabase), for home cooks
2. Stage: building toward launch → I'll fix serious bugs first, minor ones before release
3. I can test: Chrome, Firefox and Safari's engine at desktop and phone sizes.
   I can't test: a real iPhone → I'll give you a 3-minute checklist for that
4. Test accounts: none found. I'll create two (needed to check users can't see
   each other's data). No real emails, payments or customer data, ever.
5. Fixing: during the pass I'll fix serious bugs (S1–S2) myself, one commit each, and
   list the rest with a prompt for your coding agent. Say "fix all clear bugs" or
   "don't fix" to change that. I always ask before anything that changes how the app
   behaves, looks or reads
6. Add a short note to CLAUDE.md/AGENTS.md so your coding agent knows about qa/
   and hands QA requests to me, plus the read-only QA role files? (recommended)
7. Save stable checks as automated tests so later runs cost less? (adds Playwright
   as a dev dependency)
```

**Lines to add when they apply:**
- **Budget:** "Budget: standard (~$0.50–2 per everyday check). Say 'lean' or 'thorough' to change."
- **Long first passes.** Always state the honest size and time of the first full pass, using the per-check times for this kind of app (`policies/cost.md`, "Estimating"). For example: "Testing every function: about 250 checks, roughly 3–4 hours here, because this desktop app processes media. Say 'split' to spread it over several runs, highest risk first."
- **Live products:** "After-change check: a fast smoke test after each change your coding agent makes? (off by default; costs tokens per change)". On Claude Code, mention that it rides on the project `verify` skill.
- **Not a git repo:** "This folder isn't a git repo. Run `git init` so every fix can be undone? (recommended)"
- **Imported checklists:** "Do you have a client or certification checklist to import? (paste it or give me the file)"
- **Monorepo:** "I found 3 apps (web, api, mobile). Test all three, or which?"

**When to skip the wait:**
- The user's request already says "go", "use defaults" or "non-interactive": proceed, and put the kickoff in the run file.
- Autopilot, when the README or AGENTS.md answers every line: proceed, and list the assumptions in the report.
- Otherwise, in a non-interactive run, stop after writing the kickoff into `qa/runs/001-setup.md` with `interrupted: waiting for kickoff reply`.

## 3. Scaffold

- `qa init --app "<name>"` creates `qa/` from the templates and adds `qa/evidence/` and `qa/.state/` to `.gitignore`.
- Write the kickoff answers into `qa/plan.md`'s front matter: stage, autonomy, budget, modules, gates, base URL, start command, test accounts, and the opt-ins (`replay`, `after_change_check`, `role_files`).

## 4. Opt-ins the user approved

Do these now, and only these:
- **Role files:** copy `<skill>/roles/claude/*.md` to `.claude/agents/`, and `<skill>/roles/codex/*.toml` to `.codex/agents/`. Don't overwrite existing files with the same names; report them instead.
- **The coding-agent note:** append `<skill>/templates/snippets/agents-note.md` to `CLAUDE.md` and/or `AGENTS.md`, creating the file if needed. It's a few lines. Never rewrite the rest of the file.
  - **Its first line routes QA requests to this skill.** Agents with many skills installed sometimes miss a skill whose description was shortened to fit the listing. A line in CLAUDE.md or AGENTS.md is always read.
- **Replay:** add the test runner as a dev dependency (`references/integrations/replay.md`). This changes dependencies, so it happens only with this explicit OK.
- **After-change check:** `references/integrations/after-change.md`.
- **Test accounts:** create them only in the user's local or test environment, with obviously fake data (`qa-user-a@example.test`). Put their credentials in a git-ignored `.env.qa` or `qa/.state/accounts.env`, never in `qa/notes.md`.

## 5. Map the product

Spawn the scout for Job 2. It writes `qa/plan.md` (prose), `qa/notes.md` and `qa/checklist/*.md`. Then:
1. `qa validate`. Send any errors back to the scout.
2. **Guided:** show the user the checklist summary (areas, counts, the human checks) and wait.
3. **Questions for the user** go on the "needs you" list. Those checks wait; testing continues.

## 6. First pass, sized to the stage

| Stage | First pass |
|---|---|
| prototype | Smoke, the core flows, a few charters (`check` scope over the whole checklist, high-risk only) |
| building | A full baseline (`modes/full.md`) |
| near-release | A full baseline in risk order, at release-candidate depth (`modes/full.md`, then the gates) |
| rc | `modes/release.md` |
| live | A full baseline once (`modes/full.md`), then a `prod` smoke if a production URL is known |

Then fix per autonomy, verify, report, and set `last_full` in the plan.

## 7. Report

The summary block, plus three lines:
- what's in `qa/` and how to read it (`qa/STATUS.md` first);
- how to run it next time (`/enhance-qa` or `$enhance-qa`, or "QA my app");
- how to run it beside their work (`references/platforms/`).
