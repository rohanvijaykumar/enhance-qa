---
app: Corner Shop
kind: web shop (plain Node http server, server-rendered HTML, no dependencies), for homeware buyers
stage: building            # prototype | building | near-release | rc | live | hotfix
autonomy: balanced         # guided | balanced | autopilot
budget: standard           # lean | standard | thorough
modules: [web-app, accounts-auth, forms-validation, search-filter-sort, payments-subscriptions, security, accessibility, admin-backoffice]
gates: [web-launch]
base_url: http://localhost:4310
start_command: npm start
prod_url:
test_accounts: seeded on every start (README "Run it"); env QA_USER_A_EMAIL / QA_USER_A_PASSWORD and QA_USER_B_EMAIL / QA_USER_B_PASSWORD in qa/.state/accounts.env
model_fast: default
model_balanced: default
model_strong: inherit
confirm_over_usd: 2       # estimates above this ask for a one-line OK first; "never" turns it off
parallel_testers: 3
checks_per_tester: 15
agent_turns: 40           # an agent's turn budget; it then hands the rest to a fresh agent (never ends the pass)
fixes_per_batch: 20       # the most bugs one fix round takes: one build, one verification
max_loop_rounds: 10       # safety ceiling for loop only
max_usd_per_run:          # empty = no limit. If set, the run pauses there and resumes next time
rotation: 10
replay: off                # on | off
after_change_check: off    # on | off
checkpoint_commit: yes     # ask | yes | no
role_files: no
commit_qa: no
evidence: ignore           # ignore | commit
bar_fix_now: [S1, S2]
exit_criteria: [no open S1, no open S2 in core flows, high-risk checks pass, fixes verified, required human checks done or waived]
last_full: 2026-11-16
releases_since_full: 0
---
# Test plan · Corner Shop

## Product
Corner Shop is a small online homeware shop (v0.4.0). Shoppers browse and search three products, sign up or sign in with email and password, keep a cart, check out in test mode (no real payments), see their own past orders, and save a shipping address used at checkout. Footer pages: Pricing, Terms, Privacy. It runs locally as one Node process with in-memory data that resets on restart.

## Scope
In scope: every feature in the README, the HTML pages and the two JSON endpoints (`/api/products`, `/api/orders/:id`), cross-account isolation, basic web security, accessibility basics, phone width.
Out of scope (and why): real payments (test mode only, by design); email delivery for password reset (no mail system in the repo); Firefox and WebKit (not installed on this machine, listed under "Not covered"); performance at scale (3 products, in-memory).

## Areas
| Area | File | Risk | Why |
|---|---|---|---|
| Shop (browse, search, product) | checklist/shop.md | high | Entry point for every shopper |
| Auth (sign up, sign in, reset, sign out) | checklist/auth.md | high | Everyone passes through it; holds personal data |
| Cart | checklist/cart.md | high | Money path |
| Checkout | checklist/checkout.md | high | Money path |
| Orders | checklist/orders.md | high | Personal data; README promises you only see your own |
| Account | checklist/account.md | medium | Saved address feeds checkout |
| Content pages | checklist/content.md | low | Public-facing footer pages |
| Security (app-wide) | checklist/security.md | high | Data exposure, injection, secrets |
| Accessibility (app-wide) | checklist/a11y.md | medium | Labels, keyboard, phone width |

## Risks
1. One customer seeing another's orders or personal data (ORD-004, ORD-005, SEC-001, SEC-002).
2. Sign-in failures blocking every flow (AUTH-001, AUTH-002).
3. Wrong cart quantities or totals reaching checkout (CART-003..CART-007, CHK-002).
4. Injection through search or URL parameters (SEC-003, SEC-004).
5. Secrets shipped to the browser (SEC-005).

## Environments
| Tier | Cells |
|---|---|
| smoke | chrome-desktop |
| check | chrome-desktop, chrome-phone (390×844) |
| full | chrome-desktop, chrome-phone (Firefox/WebKit not installed here) |
| release | all above, plus a real phone browser (human) |

## Test data
Two seeded customers (README "Run it"): test user A and test user B; credentials in git-ignored `qa/.state/accounts.env`. User A has order #101; user B has order #102 and address "12 Oak Lane". Products: Ceramic mug $12.00 (stock 8), Linen tea towel $9.50 (out of stock), Walnut spoon $18.00 (stock 3). Restart the server to reset data.

## Questions for you
- ACCT-004: Should a new account's saved address show on the Checkout "Ship to" box? (assumed yes: README "it's used at checkout")
