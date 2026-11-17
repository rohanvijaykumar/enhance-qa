# Claude Code's `run` and `verify` skills

## `run`

- Claude Code's `/run-skill-generator` saves a project recipe for launching and driving the app at `.claude/skills/run-<name>/`.
- **If one exists,** the scout reads it during recon instead of rediscovering how to start the app, and copies the essentials (install, seed, start, URL, login) into `qa/notes.md`.
- **If none exists and the user uses Claude Code,** the scout can offer to create one from what it learned. That also helps the user's normal `/run`. It's a new project file, so it needs the user's OK. List it as an opt-in at the end of setup.

## `verify`

- **What it is:** since v2.1.286, a project skill named `verify` is run before each commit, except for docs or test changes. Strictly, Claude Code's commit instructions tell Claude to run it, so it isn't guaranteed. Claude Code also ships a built-in `/verify` that builds, runs and observes a change. A project `verify` skill is where a team writes down its own steps.
- **How they fit together:**
  - **`verify`** checks each change as the coding agent makes it, in seconds to a minute;
  - **enhance-qa** is the independent team behind it: a checklist and record across builds, a separate verifier for every bug and fix, regression checks and release go/no-go.
- **What enhance-qa adds to `verify`:**
  - its recorded replay scripts, which cost no tokens and always run;
  - the after-change agent check, only when the user opts in (`after-change.md`).
- **If a `verify` skill already exists,** enhance-qa proposes the addition and never overwrites it.
- **Lessons** (`policies/lessons.md`) can add diff-triggered steps to the `verify` skill, with the user's OK.

## Plugin form

When installed as a Claude Code plugin, the skill is also reachable as `/enhance-qa:enhance-qa`. The short `/enhance-qa` still works unless another command uses that name. The plugin's role agents are named `enhance-qa:enhance-qa-tester` and so on.
