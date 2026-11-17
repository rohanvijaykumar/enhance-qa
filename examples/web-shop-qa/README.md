# QA records

This folder is kept by **enhance-qa**, a QA team for this project. Everything is plain Markdown: read it, edit it, commit it.

- **Start with [STATUS.md](STATUS.md).** It shows the verdict, open bugs, what needs you, and the human checks for this build. Tick a box or write `→ your answer` after an item; the next run picks it up.
- **[plan.md](plan.md)** is the test plan. Its settings (stage, autonomy, budget, models, parallel testers, an optional spending limit) are at the top; change them any time.
- **[checklist/](checklist/)** holds the checks, one file per area. Add or edit checks freely; keep the IDs.
- **[bugs/](bugs/)** has one file per bug, written for people first, with a prompt you can paste into your coding agent.
- **[runs/](runs/)** has one file per pass: what was tested, the results, the evidence, and the cost.
- **[notes.md](notes.md)** is the testers' handbook: how to start the app, log in and reach each area.
- `evidence/` and `.state/` are git-ignored by default.

Run it again with `/enhance-qa` (Claude Code), `$enhance-qa` (Codex), or just say "QA my app".
