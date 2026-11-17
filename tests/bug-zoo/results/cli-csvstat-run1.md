# Bug zoo: cli-csvstat

Found 7 of 7 planted bugs (keyword match; review below). Filed: 11 bugs. Unmatched filings: 5.
Time: 1118 s · cost reported: 5.149063190000001 · turns: 34 · exit: 0

| Planted | Severity | Matched filing | Filed severity | Status |
|---|---|---|---|---|
| mean-off-by-one | S1 | BUG-001 The mean is wrong for every file | S1 | verified |
| exit-code-on-error | S2 | BUG-003 Error and usage messages go to stdout instead of stderr | S2 | verified |
| errors-on-stdout | S3 | BUG-003 Error and usage messages go to stdout instead of stderr | S2 | verified |
| delimiter-flag | S2 | BUG-002 The documented --delimiter option is rejected as unknown | S2 | verified |
| bom-header | S2 | BUG-005 Files saved by Excel (UTF-8 with BOM) aren't read: column not found or crash | S2 | verified |
| empty-file-crash | S2 | BUG-007 Empty, header-only and non-UTF-8 files crash with a Python traceback | S3 | verified |
| version-mismatch | S4 | BUG-006 --version prints 1.1.0; the README says 1.2.0 | S3 | verified |

## Filings that matched no planted bug (review: real extra finding or false alarm?)
- BUG-004 (S2, verified): A missing file exits with code 0 (success)
- BUG-008 (S3, needs-decision): --column=amount and -- (end of options) aren't supported
- BUG-009 (S3, needs-decision): nan and inf are accepted as numbers (max inf, mean nan)
- BUG-010 (S3, verified): --delimiter with no value crashes with a Python traceback
- BUG-011 (S3, verified): A --delimiter value longer than one character crashes with a Python traceback

## Final summary from the run

```
The first QA pass is done. csvstat had 11 real bugs, including a wrong mean on every file. 9 are fixed and checked by a separate verifier, and no serious bugs are left.

```
QA · Build 1→4 · setup (full baseline) · ~22 min
✓ 27 passed   ✗ 2 failed (charters; findings filed)   ⏸ 9 not run yet (8 new regression checks, 1 human check)
Verdict: no open S1 or S2 after fixes; 2 decisions and 1 human check wait for you
Fixed and verified: BUG-001 (S1) the mean was wrong on every file · BUG-002 (S2) the documented --delimiter was rejected · BUG-003 (S2) errors went to stdout instead of stderr · BUG-004 (S2) a missing file exited 0 · BUG-005 (S2) Excel files with a BOM failed · BUG-006 (S3) --version said 1.1.0 · BUG-007 (S3) tracebacks on empty, header-only and non-UTF-8 files · BUG-010 and BUG-011 (S3) crashes on a missing or multi-character --delimiter value
Needs you (2 min):
  BUG-008: accept --column=amount and -- (end of options)? (recommended: yes)
  BUG-009: treat nan/inf as non-numeric errors? (recommended: yes)
  STATS-012: a header-only file now exits 1 with "has no data rows". Keep that, or report count 0?
Your checks: 1 human-only check (CLI-013, 5 min, newcomer read of --help and the error messages) → qa/STATUS.md
Details: qa/STATUS.md · qa/runs/001-setup.md · ~$2.65 API-equivalent
```

- **Cost:** it went over my ~$1–2 estimate. BUG-010 and BUG-011 only appeared while the earlier fixes were being verified, which added two more fix-and-verify rounds.
- **Commits:** 9 fix commits on `master`, one per bug (`fix(qa): BUG-NNN …`). Nothing was pushed. `.gitignore` and `qa/` are left untracked.
- **No automated tests:** the project has no test suite, so none of the fixes has a test. Saved tests were skipped as you asked.
- **Not covered:**
  - macOS, Linux, and shells other than Git Bash and PowerShell 5.1. Only Windows 11 was available.
  - Install and packaging, because the project has no package files.
- **Where things stand:** read `qa/STATUS.md` first. Answer by ticking a box or writing `→ answer` after an item; the next run picks it up.
- **Next time:** run `/enhance-qa`, or say "QA my app". To keep your own session free, run it in a second terminal, or as `claude -w qa` to work in its own worktree.
```
