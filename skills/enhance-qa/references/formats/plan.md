# Plan format

`qa/plan.md` holds the test plan in prose, plus settings in its front matter. The settings are flat `key: value` lines, so people can edit them and scripts can read them without a YAML library. Lists are inline: `[a, b, c]`. Comments start with `#`.

```markdown
---
app: Recipe Share
kind: web app (Next.js + Supabase), for home cooks
stage: building            # prototype | building | near-release | rc | live | hotfix
autonomy: balanced         # guided | balanced | autopilot
budget: standard           # lean | standard | thorough
modules: [web-app, accounts-auth, forms-validation, file-upload-download, accessibility, security, performance, ai-built-app-risks]
gates: [web-launch]
base_url: http://localhost:3000
start_command: npm run dev
prod_url:
test_accounts: env QA_USER_A_EMAIL / QA_USER_A_PASSWORD and QA_USER_B_EMAIL / QA_USER_B_PASSWORD (seeded by `npm run seed:qa`)
model_fast: haiku
model_balanced: sonnet
model_strong: inherit
confirm_over_usd: 2       # estimates above this ask for a one-line OK first; "never" turns it off
parallel_testers: 3
checks_per_tester: 15
agent_turns: 40           # an agent's turn budget; it then hands the rest to a fresh agent (never ends the pass)
fixes_per_batch: 20       # fixes are made and verified in batches until all are done
max_loop_rounds: 3        # loop only: rounds before stepping back
max_usd_per_run:          # empty = no limit. If set, the run pauses there and resumes next time
rotation: 10
replay: off                # on | off
after_change_check: off    # on | off
checkpoint_commit: ask     # ask | yes | no (remembered after the first time)
role_files: no             # yes once the user approved installing them
commit_qa: no              # yes lets QA commit qa/ changes itself
evidence: ignore           # ignore | commit
bar_fix_now: [S1, S2]
exit_criteria: [no open S1, no open S2 in core flows, high-risk checks pass, fixes verified, required human checks done or waived]
last_full: 2026-11-16
releases_since_full: 0
---
# Test plan · Recipe Share

## Product
One paragraph: what it is, who uses it, the main tasks, where it runs.

## Scope
In scope: …  Out of scope (and why): …

## Areas
| Area | File | Risk | Why |
|---|---|---|---|
| Auth | checklist/auth.md | high | Everyone passes through it; holds personal data |

## Risks
The top risks, in order, with the checks that cover them.

## Environments
| Tier | Cells |
|---|---|
| smoke | chromium-desktop |
| check | chromium-desktop, chromium-phone |
| full | pairwise: {chromium, firefox, webkit} × {desktop, phone} |
| release | all, plus real iPhone Safari (human) |

## Test data
Accounts, seed commands, fixtures, sandboxes (payment test mode, Mailpit).

## Questions for you
Open questions about expected results, each linked to its check.
```

## Settings the scripts read

`stage`, `autonomy`, `budget`, `modules`, `gates`, `rotation`, `confirm_over_usd`, `parallel_testers`, `checks_per_tester`, `agent_turns`, `fixes_per_batch`, `max_loop_rounds`, `max_usd_per_run`, the `model_*` keys, `replay`, `checkpoint_commit`, `commit_qa`, `evidence`, `bar_fix_now`, `last_full` and `releases_since_full`. Unknown keys are kept and ignored, so the user can add their own notes.
