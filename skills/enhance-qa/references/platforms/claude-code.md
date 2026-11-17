# Running the team in Claude Code

## Spawning roles

Use the **Agent** tool, one call per role instance. For parallel testers, send all the calls in one message.

| Role | `subagent_type` | `model` | `effort` |
|---|---|---|---|
| Scout | `enhance-qa-scout` if installed, else `general-purpose` | omit (inherits the session's model) or `qa/plan.md` `model_strong` | `high` |
| Tester, scripted or one-screen checks | `enhance-qa-tester`, else `general-purpose` | `haiku` (`model_fast`) | `low` |
| Tester, multi-step flows or charters | `enhance-qa-tester`, else `general-purpose` | `sonnet` (`model_balanced`) | `medium` |
| Verifier | `enhance-qa-verifier`, else `general-purpose` | `sonnet` (`model_balanced`) | `medium` |
| Fixer, clear one-file defects | `enhance-qa-fixer`, else `general-purpose` | `sonnet` (`model_balanced`) | `medium` |
| Fixer, security, auth, data, payments, multi-file or a second attempt | `enhance-qa-fixer`, else `general-purpose` | omit (inherits) or `model_strong` | `high` |

**Which role definitions exist.** They're installed with the user's OK, or come with the plugin. Look for:
- `.claude/agents/enhance-qa-*.md` (project) or `~/.claude/agents/enhance-qa-*.md` (user): `subagent_type` is `enhance-qa-tester`;
- the plugin form: `enhance-qa:enhance-qa-tester`.

If none exist, use `general-purpose` and put the full role prompt at the top of the brief (`roles/lead.md` has the brief layouts). The role prompt is the same either way, so behaviour matches.

**Model and effort.**
- A per-call `model` beats the definition's `model`.
- Use the aliases `haiku`, `sonnet` and `opus`, or omit `model` to inherit.
- Pass `effort` per call where the version supports it; otherwise the definition's `effort` applies.
- The environment variables `CLAUDE_CODE_SUBAGENT_MODEL` and `CLAUDE_CODE_EFFORT_LEVEL` override both, which is the user's choice.

**Waiting.**
- Subagents spawned from the main conversation start in the background. Don't start the next phase until every agent of the current phase has reported back.
- In a non-interactive run (`claude -p`), spawn in the foreground (`run_in_background: false`), so results return directly.

**Nesting.** Roles don't spawn their own subagents. The role definitions leave out the Agent tool; with `general-purpose`, say "don't spawn subagents" in the brief.

**Concurrency.** `parallel_testers` testers at once (default 3). Start the next batch as soon as one finishes, until every batch is done. Claude Code allows up to 20 running subagents, but more testers use usage limits faster and load the app under test more.

**Turn budget.** A subagent that reaches `agent_turns`, or that Claude Code returns marked as partial, has written its notes. Spawn a fresh one, or resume it, for the checks it didn't reach. The pass doesn't end there.

## Enforcing the roles

- **Always:** the lead runs `qa phase start --role <role>` before and `qa gate --role <role>` after each phase. That's the real enforcement, and it works everywhere.
- **Role definitions** remove the Agent tool from every role, and remove Edit and NotebookEdit from testers and the verifier. They keep Write, for their notes and evidence.
- **Plugin hooks** (when the plugin is installed) add a second layer:
  - a `PreToolUse` hook denies file edits outside the current phase's allowed paths. It reads `qa/.state/phase.json`, and does nothing when no QA phase is active;
  - a `SubagentStop` hook sends a tester back if its results lack evidence.

## Running beside the user's work

Long passes shouldn't block the user's own session. Offer the user these, in order:
1. **A new session in the desktop app** (or a second terminal) on the same folder, started with `/enhance-qa`.
2. **`claude -w qa`** in a second terminal: its own worktree at `.claude/worktrees/qa`. Fix commits land on that worktree's branch, and merging is the user's call.
3. **`claude --bg "/enhance-qa"`** (research preview): runs in the background and moves into its own worktree before editing.

**Which build gets tested:**
- **In the user's own session,** QA tests exactly what's on disk (`qa snapshot` includes uncommitted and new files).
- **In a separate worktree,** it tests that worktree's commit. Say which in the announcement.

## Non-interactive and CI

- **`claude -p "/enhance-qa check" --output-format json`** runs a pass headless. Add `--permission-mode acceptEdits`, or an allowlist, so the run doesn't stall on prompts.
- **Spending limit:** only if the user set `max_usd_per_run`, also pass `--max-budget-usd <same value>`. If it's reached, the next run resumes the pass.
- **Don't use `--bare`.** It skips skills and agents.
- The JSON output's `usage` and `total_cost_usd` feed the run file's cost ledger.
- **CI recipe:** `references/integrations/ci.md`.

## Using what Claude Code already has

- **A project `run-<name>` skill** (from `/run-skill-generator`) is a ready-made "how to launch and drive this app" recipe. The scout reads it instead of rediscovering, and copies the essentials into `qa/notes.md`.
- **A project `verify` skill** runs before each commit (v2.1.286+). If the user opted into the after-change check, add the fast check there (`references/integrations/after-change.md`). If a `verify` skill already exists, propose the addition; never overwrite it.
- **The desktop app's built-in browser** and **Claude in Chrome** can drive web apps (`drivers.md`). Claude in Chrome uses the user's real browser and logins, so use it only with the user's OK.
