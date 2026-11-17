# CI recipes (optional)

Run a QA pass on pull requests or before releases. These recipes are given to the user to add themselves. QA never edits CI config without the user's OK (safety rule 6).

## Claude Code: `anthropics/claude-code-action@v1`

```yaml
# .github/workflows/qa.yml
name: QA
on:
  pull_request:
  workflow_dispatch:
jobs:
  qa:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npx playwright install --with-deps chromium
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "/enhance-qa check. Non-interactive: use the plan's defaults, don't fix, report only."
          # Optional spending limit. If it's reached, the next run resumes the pass:
          # claude_args: "--max-budget-usd 5"
```

- Don't pass `--bare`. It skips skills and agents.
- The skill must be in the repo, at `.claude/skills/enhance-qa/`, or loaded through the action's `plugin_marketplaces` and `plugins` inputs.
- **Report only in CI:** the pass doesn't fix or commit. Post the summary as a PR comment if the user wants that.

## Codex: `openai/codex-action@v1`

```yaml
      - uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt: "Use the enhance-qa skill: check. Non-interactive: use the plan's defaults, don't fix, report only."
          sandbox: workspace-write
          safety-strategy: drop-sudo
```

- The skill must be in the repo, at `.agents/skills/enhance-qa/`.
- Project hooks need trust, so in CI the gate runs as part of the pass (`qa gate`), not as a hook.

## Notes

- **CI runners have no GUI:** use headless browsers. GUI-only checks are marked `blocked` in CI and listed for local runs, never skipped quietly.
- **Keep secrets in the CI secret store.** Test accounts come from CI environment variables.
- **Evidence:** upload `qa/evidence/` as a workflow artefact if the user wants it.
