# Bug zoo: web-shop, second run (everyday `check`)

Setup for this run (simulating a day of normal work after run 1):
- The "user's own coding agent" fixed BUG-002 (admin page open to customers) and marked it `fixed`.
- At the same time, a regression was planted: cart rows show the unit price instead of the line amount.
- The prompt was a bare `/enhance-qa` (non-interactive); no mode named.

| What we wanted to see | Result |
|---|---|
| Picks `check` by itself | Yes (`mode: check`, build 5) |
| Verifies the user's own fix independently | Yes: BUG-002 `verified`, with variants (`/admin/`, `/ADMIN`, `/admin?x=1`, `/admin%2f`, three accounts, signed out) |
| Catches the planted regression | Yes: BUG-022 "Cart rows show the unit price, not the line amount, after the quantity changes" |
| Treats the regression as a clear defect | No: it was set to `needs-decision`. Fixed in the rules afterwards (`checkpoints.md`: regressions restoring earlier behaviour are clear defects) |
| False alarms | None seen. Six more real edge cases filed (S3–S4): huge quantity overflow, spaces-only password and name, Back after sign-out shows the account page, a long search word breaks phone width, search doesn't trim spaces |
| Fixing | None, correctly: at the `building` stage S3 is `before-release` and S4 `later` |
| Spot audit | Ran (10% of passes re-checked by a different tester) |

Time: 780 s · cost reported: $3.75 (Opus $2.27, Sonnet $1.43, Haiku $0.04) · 72 lead turns.

Note: this app keeps every route in one `server.js`, so every area's `Paths` covers it and a `check` re-tested 71 of 79 checks, which is close to a full pass. On apps split across files, impact selection narrows much more.
