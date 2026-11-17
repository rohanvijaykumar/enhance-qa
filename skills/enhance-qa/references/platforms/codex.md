# Running the team in Codex

Codex spawns subagents **only when explicitly asked**, and the parent waits until all requested results are back. So spell out every spawn: which role, how many, which model and effort, and that you'll wait.

## Spawning roles

Say it in so many words, for example:

> Spawn 3 subagents in parallel, one per batch below. Each uses model gpt-6-luna with low reasoning effort and follows the tester instructions at the top of its brief. Wait for all three, then continue.

| Role | Custom agent (if installed) | Model | Reasoning effort |
|---|---|---|---|
| Scout | `enhance_qa_scout` | the session's model (`model_strong`) | high |
| Tester, scripted or one-screen | `enhance_qa_tester` | `gpt-6-luna` (`model_fast`) | low |
| Tester, multi-step or charter | `enhance_qa_tester` | `gpt-6.1-sol`, or `gpt-6.1-terra` to save cost (`model_balanced`) | medium |
| Verifier | `enhance_qa_verifier` | `gpt-6.1-sol` | medium |
| Fixer, clear one-file defects | `enhance_qa_fixer` | `gpt-6.1-sol` (`model_balanced`) | medium |
| Fixer, security, auth, data, payments, multi-file or a second attempt | `enhance_qa_fixer` | the session's model | high |

**Custom agents.** They live in `.codex/agents/enhance-qa-*.toml`, installed with the user's OK at kickoff. When they exist, name them in the spawn request ("spawn the enhance_qa_tester agent…"). Their `model` and `model_reasoning_effort` take precedence. Otherwise use the built-in `default` agent, and put the full role prompt at the top of each brief.

**Model names.** These are the defaults as of 16 Nov 2026. The plan's `model_*` keys override them. If a model isn't available on the user's plan, fall back to the session's model and note it in the run file.

**Parallel testers.** `parallel_testers` (default 3), within the user's `agents.max_concurrent_threads_per_session`. Spawn the next batch as soon as one finishes, until every batch is done.

**Turn budget.** A subagent that runs out of turns (`agent_turns`) writes its notes. Spawn a fresh one for the checks it didn't reach; the pass doesn't end there.

**Don't nest.** Tell each role not to spawn subagents of its own.

## Enforcing the roles

- **Codex subagents inherit the parent's sandbox,** so a tester or verifier subagent can't be made read-only. The real enforcement is the gate: `qa phase start --role <role>` before and `qa gate --role <role>` after every phase. It reverts edits outside the role's allowed files and fails the phase on checklist changes.
- **A stronger verifier, where it works:** run it as a separate read-only process.
  ```
  codex exec --sandbox read-only --ephemeral -m gpt-6.1-sol -o qa/runs/<run>/verifier-<k>.out "<verifier brief>"
  ```
  - Then copy its verdicts into `qa/runs/<run>/verifier-<k>.md` yourself.
  - A read-only sandbox can't write caches or evidence, so it suits verifying against an already-running app: start the app first, outside the sandbox. Whether a sandboxed session can start a nested `codex exec` varies.
  - If the command isn't allowed or fails, use a normal subagent plus the gate, and write "verifier separation: subagent + gate" in the run file.
- **Optional hooks.** With the user's OK, `.codex/hooks.json` can call the same gate script on `PreToolUse` (`references/integrations/codex-hooks.md`). Codex asks the user to review and trust project hooks before they run.

## Running beside the user's work

Long passes would otherwise block the user's thread, because the parent waits for its subagents:
1. **A Worktree chat in the Codex app:** "queue up background work while you stay focused". It copies uncommitted changes into the worktree.
2. **`codex exec --worktree "$enhance-qa check"`** from a terminal.
3. **Cloud tasks:** whether skills load there is unverified. Say so if the user asks.

Fix commits land on the worktree's branch. Merging is the user's call.

## Non-interactive and CI

- **`codex exec "Use the enhance-qa skill: check"`** runs a pass headless. Use `--sandbox workspace-write` so testers can run the app and write notes, and `--json` for the event stream (usage for the cost ledger).
- **`--trust`**, or a trusted project, is needed for project config and project hooks.
- **CI recipe:** `references/integrations/ci.md` (`openai/codex-action@v1`).

## Browser

- **The Codex app's built-in browser** (`@Browser`) and **the Chrome extension** (`@Chrome`) can drive web apps in the app.
- **The CLI and IDE have no browser of their own.** Use Playwright scripts or the Playwright MCP (`drivers.md`). CLI drivers save the 4–6k tokens per request that MCP tool definitions cost.
