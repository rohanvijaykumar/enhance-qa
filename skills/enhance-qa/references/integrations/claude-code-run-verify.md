# Claude Code's `run` and `verify` skills

## `run`

- Claude Code's `/run-skill-generator` saves a project recipe for launching and driving the app at `.claude/skills/run-<name>/`.
- **If one exists,** the scout reads it during recon instead of rediscovering how to start the app, and copies the essentials (install, seed, start, URL, login) into `qa/notes.md`.
- **If none exists and the user uses Claude Code,** the scout can offer to create one from what it learned. That also helps the user's normal `/run`. It's a new project file, so it needs the user's OK. List it as an opt-in at the end of setup.

## `verify`

- **What it is:** since v2.1.286, a project skill named `verify` is run before each commit, except for docs or test changes. Strictly, Claude Code's commit instructions tell Claude to run it, so it isn't guaranteed.
- **What enhance-qa adds to it:** the after-change check (`after-change.md`), when the user opts in.
- **If a `verify` skill already exists,** enhance-qa proposes the addition and never overwrites it.

## Plugin form

When installed as a Claude Code plugin, the skill is also reachable as `/enhance-qa:enhance-qa`. The short `/enhance-qa` still works unless another command uses that name. The plugin's role agents are named `enhance-qa:enhance-qa-tester` and so on.
