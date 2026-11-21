---
app: {{app}}
kind:
stage: building            # prototype | building | near-release | rc | live | hotfix
autonomy: balanced         # guided | balanced | autopilot
budget: standard           # lean | standard | thorough
modules: []
gates: []
base_url:
start_command:
prod_url:
test_accounts:
model_fast: default
model_balanced: default
model_strong: inherit
confirm_over_usd: 2       # estimates above this ask for a one-line OK first; "never" turns it off
parallel_testers: 3
checks_per_tester: 15
agent_turns: 40           # an agent's turn budget; it then hands the rest to a fresh agent (never ends the pass)
fixes_per_batch: 20       # the most bugs one fix round takes: one build, one verification
max_loop_rounds: 3        # loop only: rounds before stepping back
fix_during_run: serious   # serious (S1-S2) | clear | none: how much a test pass fixes; fix mode fixes the rest
max_usd_per_run:          # empty = no limit. If set, the run pauses there and resumes next time
rotation: 10
replay: off                # on | off
after_change_check: off    # on | off
checkpoint_commit: ask     # ask | yes | no
role_files: no
commit_qa: no
evidence: ignore           # ignore | commit
bar_fix_now: [S1, S2]
exit_criteria: [no open S1, no open S2 in core flows, high-risk checks pass, fixes verified, required human checks done or waived]
last_full:
releases_since_full: 0
---
# Test plan · {{app}}

## Product
(What it is, who uses it, the main tasks, where it runs.)

## Scope
In scope:
Out of scope (and why):

## Areas
| Area | File | Risk | Why |
|---|---|---|---|

## Risks
(The top risks, in order, with the checks that cover them.)

## Environments
| Tier | Cells |
|---|---|
| smoke | |
| check | |
| full | |
| release | |

## Test data
(Accounts, seed commands, fixtures, sandboxes. Never real credentials: name environment variables.)

## Questions for you
