# Bug format

One file per bug: `qa/bugs/BUG-019.md`. A small front matter for the fields scripts read, then plain sections for people. Get the next ID with `qa next-id bug`.

```markdown
---
id: BUG-019
title: A wrong password shows a 500 error page
status: open
severity: S2
priority: fix-now
found: build 7 · AUTH-002 · Chrome / Windows 11
repro: 3/3
area: auth
tags: [security]
---
## What a user sees
Typing a wrong password crashes the login page instead of saying "wrong password".

## Why it matters
Everyone who mistypes a password hits an error page, and it looks broken.

## Steps
1. Open /login
2. Enter a registered email and a wrong password, then submit

## Expected
"Incorrect email or password", staying on /login (source: AUTH-002)

## Actual
A "500 Internal Server Error" page. Console: TypeError: user.compare is not a function (auth.ts:42)

## Evidence
evidence/007/auth-002.png · evidence/007/auth-002-server.log (lines 12–30)

## Prompt for your coding agent
On /login, a wrong password throws "user.compare is not a function" (auth.ts:42) and shows a 500 page. Make a wrong password show "Incorrect email or password" and stay on /login. Add a test for it.

## Fix notes
(written by the fixer: cause, change, files, halo, commit)

## Verification log
(written by the verifier: build, result, what was tried)
```

## Front matter

| Key | Required | Values |
|---|---|---|
| `id` | yes | `BUG-NNN` (three or more digits), matching the file name |
| `title` | yes | What's wrong, in a user's words |
| `status` | yes | See below |
| `severity` | yes | `S1` blocker, `S2` major, `S3` minor, `S4` cosmetic (`policies/severity.md`) |
| `priority` | yes | `fix-now`, `before-release`, `later` |
| `found` | yes | `build N · CHECK-ID or charter · environment` |
| `repro` | yes | Reproduction count on the found build, such as `3/3` or `2/3` |
| `area` | yes | The area file it belongs to (`auth` for `checklist/auth.md`) |
| `tags` | no | Inline list: `security`, `a11y`, `escaped`, `regression`, `pre-existing`, `not-useful`, `scanner`, `flaky`. `pre-existing` means the problem was already there before the change being checked. It's still a bug, but the latest change didn't cause it |
| `class` | no | The kind of mistake, in a short kebab-case phrase (`trusts-client-quantity`, `missing-ownership-check`). The fixer names it in its notes; the lead copies it here. Repeats become lessons (`policies/lessons.md`) |
| `source` | no | `tester` (default), `reported` (the user saw it), `escaped` (a user in the wild saw it), `scanner` (from a platform scanner) |
| `fixed_in` | no | The fix commit (short SHA) |
| `verified_in` | no | The build the verifier closed it on |
| `attempts` | no | Fix attempts so far |
| `duplicate_of` | no | `BUG-NNN` |
| `decision` | no | The user's decision, with the date: `by design (2026-11-16)` |

## Statuses

| Status | Meaning | Set by |
|---|---|---|
| `new` | Reported by a tester; not yet reproduced by the verifier | lead |
| `open` | Reproduced by the verifier; waiting to be fixed | lead, after the verifier |
| `fixed` | A fix is committed and waiting for verification | fixer, or the user's coding agent |
| `verified` | A fresh verifier confirmed the fix. Closed | verifier only |
| `reopened` | Verification failed; back to fixing (`attempts` + 1) | verifier |
| `needs-decision` | Waiting for the user: bug or by design, behaviour change, two failed attempts | lead |
| `deferred` | Known and accepted for now | user, or the lead on Autopilot |
| `wont-fix` | Won't be fixed; the reason goes in `decision` | user |
| `by-design` | Not a bug. The check's expected result is updated, with the decision as its source | user |
| `duplicate` | Same root cause as `duplicate_of` | lead |
| `cant-reproduce` | The verifier couldn't reproduce it in 3 tries on the found build | lead, after the verifier |

**Open for release purposes:** `new`, `open`, `fixed`, `reopened`, `needs-decision`.

## Writing a good bug

- **"What a user sees" and "Why it matters"** are plain language for a non-developer. No jargon in the first two sections.
- **Steps** are numbered and minimal: the shortest path that reproduces it, from a stated starting point.
- **Expected** names its source (the check, the docs, the user's decision).
- **Actual** quotes exact text, codes and error lines.
- **Evidence** lists paths under `qa/evidence/`, after redaction. One screenshot for a static problem; a short recording where the platform can record, for interactive ones.
- **The prompt for your coding agent** is self-contained: where, what happens, what should happen, and "add a test". It should work pasted into Claude Code, Codex, Cursor, Lovable, Bolt or Replit.
