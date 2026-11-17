# Run file format

One file per pass: `qa/runs/007-check.md`, numbered in order (`qa next-id run`). Role notes go in a folder of the same number: `qa/runs/007/tester-1.md`, `verifier-1.md`, `fixer.md`.

## The run file

```markdown
---
run: 7
mode: check
build: 12
commit: 9c1e0a4
head: 4f3a2c1
tree: 7b2d11e
started: 2026-11-16T21:30
finished: 2026-11-16T21:40
budget: standard
verdict: Not ready — 1 major bug open
interrupted: no
---
# Run 007 · check · build 12

## Scope
Smoke (8) + verify 3 fixes + 24 checks around cart and auth (6 files changed since build 11) + rotation (4) = 39 checks.
Environment: local dev server, Chromium 131 desktop and phone width, Windows 11.
Uncommitted changes included in the snapshot: src/cart/badge.tsx (new).

## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| SMOKE-001 | pass | Home loads in 0.8 s | evidence/007/smoke-001.txt | |
| AUTH-002 | fail | 500 page on wrong password | evidence/007/auth-002.png | BUG-019 |
| CART-004 | pass | "Your cart is empty" shown, badge 0 | evidence/007/cart-004.txt | |
| VIS-003 | human-pending | Needs your eyes | | |

## Bugs
- New: BUG-019 (S2) A wrong password shows a 500 page · BUG-020 (S3) Pricing typo
- Verified: BUG-012, BUG-015 · Reopened: BUG-014 (still fails at phone width)

## Exploratory notes
- CART-020 (money tour, 20 min): covered add, update quantity, remove, coupon. Found BUG-020.

## Signal
Previous reports acted on: 9 of 10 (90%). Dismissed: BUG-011 (not useful).

## Cost
| Role | Model | Agents | Tokens in / out | ≈ Cost |
|---|---|---|---|---|
| Lead | session | 1 | 41k / 6k | $0.20 |
| Testers | haiku | 3 | 210k / 18k | $0.03 |
| Verifier | sonnet | 1 | 52k / 5k | $0.15 |
| Total | | | | ≈ $0.38 |

## Needs you
- [ ] BUG-018 "Delete account" has no confirmation step. Bug (add a confirmation) or by design?

## Not covered
- SAFARI cells: no WebKit driver on this machine → listed as human checks.
```

## Front matter

| Key | Meaning |
|---|---|
| `run` | Run number |
| `mode` | `setup`, `check`, `full`, `release`, `fix`, `loop`, `area:<name>`, `bug`, `prod` |
| `build` | Build number from `qa snapshot` |
| `commit` | The snapshot commit (hidden ref) |
| `head` | The branch commit at snapshot time |
| `tree` | The tree hash of the snapshot, which identifies the exact files |
| `started`, `finished` | Local time, ISO format |
| `budget` | `lean`, `standard`, `thorough` |
| `verdict` | One line. Release passes: "Ready for your approval" or "Not ready — <reason>" |
| `interrupted` | `no`, or what stopped it and where to resume |
| `progress` | Updated after every phase and tester batch: the phases done and the batches left, for example `intake done · test 2/3 batches · confirm · triage · report` |

## Result values

| Result | Meaning |
|---|---|
| `pass` | Observed the expected result, with evidence |
| `fail` | Didn't. Evidence required. A bug or candidate is linked |
| `blocked` | Couldn't run: give the reason (no driver, a dependency failed, waiting on a question) |
| `skip` | Deliberately not run this time: give the reason |
| `flaky` | Mixed results: write n/N in the note, for example "fail 2/3" |
| `human-pending` | A human, device or gate check waiting for the user |
| `pass-human` | The user did it and it passed |
| `waived` | The user waived it, with the date |
| `not-run` | Planned but not reached yet: the session was interrupted, or the user's spending limit was reached. The next run resumes it |

**A result without evidence counts as `not-run`.** Evidence is a path under `qa/evidence/<run>/`, or a short quoted observation for text results (an exit code, a status code, the exact message).

## Role notes

Testers write `qa/runs/<run>/tester-<n>.md`:

```markdown
# Run 007 · tester 1 · area: cart
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| CART-001 | pass | Badge 1 after 0.4 s | evidence/007/cart-001.txt | |
| CART-007 | fail | Quantity accepts -1; total goes negative | evidence/007/cart-007.png | candidate C1 |

## Candidates
### C1 · Quantity accepts negative numbers
- Check: CART-007 · Severity guess: S2 · Seen: 3/3
- Steps: Add a product → open the cart → type -1 in the quantity box → Tab
- Expected: The quantity is rejected or reset to 1 (source: CART-007)
- Actual: Quantity -1; the subtotal shows -$12.00
- Evidence: evidence/007/cart-007.png

## Learned
- The cart drawer needs about 300 ms after "Add to cart" before it's clickable.
```

`qa results merge <run>` copies every role's results table into the run file's "Results" table: the last result per check wins, with fails kept over passes. The lead files bugs from the candidates after the verifier has reproduced them.
