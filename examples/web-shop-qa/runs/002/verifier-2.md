### BUG-002
- Log: 2026-11-16 · build 5 · Verified. User A opening /admin gets 404 Not Found, no user list (2/2, fresh sessions). Variants: /admin/, /ADMIN, /admin?x=1, /admin%2f, /Admin/ all 404; user B 404; fresh r2v2- signup customer 404. Halo: signed-out /admin → 302 /login?next=/admin, no list. User A /account still 200. Tests: tamper-tests reported no flags since build 1; I did not read test diffs (black-box brief). Evidence: evidence/002/v2-admin-results.txt (emails redacted; no @ in any response body)
- Verdict: Verified
