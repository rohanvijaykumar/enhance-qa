# Codex hooks (optional)

The gate script can also run as a Codex hook. It adds a second layer to `qa gate`, which is the real enforcement. Install it only with the user's OK: it's persistent project configuration, and Codex asks the user to review and trust project hooks before they run.

## `.codex/hooks.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "apply_patch|Edit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .agents/skills/enhance-qa/scripts/qa.mjs hook pre-tool-use || python3 .agents/skills/enhance-qa/scripts/qa.py hook pre-tool-use",
            "commandWindows": "node .agents\\skills\\enhance-qa\\scripts\\qa.mjs hook pre-tool-use || python .agents\\skills\\enhance-qa\\scripts\\qa.py hook pre-tool-use"
          }
        ]
      }
    ]
  }
}
```

Adjust the path if the skill is installed elsewhere (for example under `~/.agents/skills/`).

## What it does

- **With no QA phase active** (no `qa/.state/phase.json`), it allows everything and exits at once. It never slows down normal work.
- **During a tester or verifier phase,** it denies file edits outside `qa/runs/` and `qa/evidence/`, and edits to the checklist.
- **During a fixer phase,** it denies edits to `qa/checklist/`, `qa/plan.md` and `qa/notes.md`.
- **In every phase,** it denies `git push`, history rewrites and force operations.

## Limits

- Codex lets a tool run if a hook errors or times out, so the hook is a convenience. The gate after each phase still catches and reverts violations.
- Codex sends `apply_patch` as patch text. The hook reads the file paths from the patch headers.
