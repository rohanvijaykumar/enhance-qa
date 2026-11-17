# The after-change check

**Off by default.** Offered at kickoff for live products. Setting: `after_change_check: on|off` in `qa/plan.md`.

When the user's coding agent finishes a change, a fast-tier smoke and impact check runs on the affected areas. Findings then show up in the user's flow, which is where developers actually act on them: Meta found about 70% fixed, against near zero for batch reports. It costs tokens on every change, which is why it's opt-in.

## What it runs

- `qa select --json --quick`: the smoke checks, plus the high-risk checks in the changed areas, capped at 10 checks.
- One fast-tier tester. No fixing, and no filing without the verifier: candidates are listed as "possible problems" for the coding agent to look at.
- About a minute, and about $0.02–0.10 at API prices.

## Claude Code: through the project `verify` skill

Since v2.1.286, Claude Code runs a project skill named `verify` before each commit, except for docs or test changes. Strictly, Claude Code's commit instructions tell Claude to run it, so it isn't guaranteed.

1. **If `.claude/skills/verify/SKILL.md` doesn't exist,** create it from `<skill>/templates/snippets/verify-skill.md`.
2. **If it exists,** show the user the lines to add, from the same snippet's "Add this section" part. Never overwrite it.
3. The section tells Claude to run `/enhance-qa` in after-change mode ("enhance-qa quick check of what changed"), and to report possible problems before committing.

## Codex and other tools

Add a line to AGENTS.md (`<skill>/templates/snippets/agents-note.md` has an optional line for it): "After finishing a change, run `$enhance-qa quick check of what changed` and report possible problems." This depends on the agent following AGENTS.md, so it isn't guaranteed either.

## Turning it off

Set `after_change_check: off`, and remove the section from the `verify` skill or the AGENTS.md line.
