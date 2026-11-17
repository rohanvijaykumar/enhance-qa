# Running the team elsewhere, or without subagents

## Tools with subagents

| Tool | How to spawn roles | Read-only roles | Notes |
|---|---|---|---|
| **Cursor** | Its subagents. It reads `.claude/agents/` and `.codex/agents/` role files too | `readonly: true` in a Cursor agent definition | Reads `.agents/skills`, `.claude/skills` and `.cursor/skills`. Browser through its built-in browser |
| **GitHub Copilot** (CLI, VS Code, cloud agent) | Custom agents (`.github/agents/enhance-qa-*.agent.md`, with `tools`) or its built-in subagents | `tools` without edit tools | The CLI and cloud agent read `.agents/skills`. Browser: Playwright MCP (cloud agent), browser tools (VS Code) |
| **Antigravity** | Subagents with `workspace: branch` | n/d | Reads `.agents/skills`. Browser subagent in the app |
| **Gemini CLI** | Subagents can't nest, so the lead spawns every role itself | n/d | No explicit skill call; ship `.gemini/commands/qa.toml` as a wrapper if the user wants one |

Use the same role prompts and briefs (`roles/`), and the same gate. Model tiers: pick the platform's fast, balanced and strong models. Put the mapping in `qa/plan.md` (`model_fast`, `model_balanced`, `model_strong`).

## No subagents at all: the sequential fallback

Run the phases yourself, one role at a time:
1. **Switch roles deliberately.** Before each phase:
   - re-read that role's prompt;
   - run `qa phase start --role <role>`;
   - work only within that role's rules.

   Testers stay black-box: don't open source files during a tester phase, even though you could.
2. **After each phase,** run `qa gate --role <role>` and fix any violation it reports (revert what you shouldn't have touched).
3. **The verifier must be a separate process wherever one exists,** so a fix is never verified by the context that wrote it. Write the brief to a file and run one of these:

   | Tool | Command |
   |---|---|
   | Claude Code | `claude -p --model sonnet --disallowedTools "Edit,NotebookEdit,Agent" "$(cat qa/runs/<run>/verifier-brief.md)" > qa/runs/<run>/verifier-1.out` |
   | Codex | `codex exec --sandbox read-only --ephemeral -m gpt-6.1-sol -o qa/runs/<run>/verifier-1.out "$(cat qa/runs/<run>/verifier-brief.md)"` |
   | Cursor | `agent -p --mode ask "…"` |
   | Gemini CLI | `gemini -p "…"` |
   | Copilot CLI | `copilot -p "…" --deny-tool write` |

   Then copy its verdicts into `qa/runs/<run>/verifier-1.md`.
4. **If no separate process is possible,** verify in a fresh context if the tool allows one: a new chat, or after clearing. As the last resort, verify yourself, and write "verifier separation: same agent (weak)" in the run file and the summary.

## Gates and hooks elsewhere

`qa gate` works everywhere and is the real enforcement. Hooks add a layer where the tool supports them, and the same gate script can back them:
- **Cursor:** `.cursor/hooks.json`, `preToolUse` deny.
- **Copilot:** `.github/hooks/*.json`, `preToolUse` deny.
- **Gemini CLI:** `BeforeTool` deny.
- **Antigravity:** `PreToolUse` deny.

Install hooks only with the user's OK, because they're persistent configuration.
