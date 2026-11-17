# Run 002 · tester 1 · area: auth
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| AUTH-002 | pass | 200, "Incorrect email or password", no sid set | evidence/002/t1-batch1.txt | |
| AUTH-014 | pass | No script tag (escaped in hidden input). next=https://example.com -> Location /; //evil.test -> /; /orders -> /orders (needed MSYS_NO_PATHCONV=1) | evidence/002/t1-batch1.txt, t1-batch2.txt | |
| AUTH-015 | pass | Desktop (curl) and 390x844 (browser): error shown, not signed in | evidence/002/t1-auth015-phone.png, t1-batch1.txt | |
| AUTH-016 | pass | "An account with this email already exists" for exact and CAPS+trailing space; A signs in, sees #101 | evidence/002/t1-batch1.txt | |
| AUTH-017 | pass | 302 Location /login?next=/orders with old sid | evidence/002/t1-batch1.txt | |
| AUTH-018 | pass | "Enter a valid email address" for not-an-email and a@b | evidence/002/t1-batch1.txt | |
| AUTH-007 | pass | Refused; A's own password signs in; sees #101 (and #103, another tester's order); Dup's password longenough1 rejected for A | evidence/002/t1-batch1.txt | |
| AUTH-009 | pass | Browser: sign out then /orders -> /login?next=/orders, header "Sign in"; curl same | evidence/002/t1-p2.json, t1-batch3.txt | |
| AUTH-003 | pass | Same message | evidence/002/t1-batch3.txt | |
| AUTH-006 | pass | "Password must be at least 8 characters"; login with that email fails | evidence/002/t1-batch3.txt | |
| AUTH-008 | pass | "Enter a valid email address" | evidence/002/t1-batch3.txt | |
| AUTH-010 | pass | Old sid: /orders 302 /login, /api/orders/101 401 | evidence/002/t1-batch3.txt | |
| AUTH-011 | pass | Identical "Check your email" page for A and nobody@ | evidence/002/t1-batch3.txt | |
| AUTH-012 | pass | /orders -> /login?next=/orders -> sign in -> /orders | evidence/002/t1-p2.json | |
| AUTH-004 | pass | CAPS email + trailing space + right password -> 302 / with sid | evidence/002/t1-batch3.txt | |
| AUTH-013 | fail | Charter; see candidates C1-C3 | evidence/002/t1-p3.json, t1-batch4.txt | |
## Candidates
### C1 · Sign up accepts a whitespace-only password
- Check: AUTH-013 · Severity guess: S3 · Seen: 2/2
- Steps: POST /signup name=WS, email=r2t1-wp2@example.test (new), password = 8 spaces (also in the form)
- Expected: Password rejected like a short password (source: AUTH-006 forms-validation; judgement)
- Actual: 302 to /account, account created; sign-in with the 8 spaces works (302 /)
- Evidence: qa/evidence/002/t1-batch3.txt (ws signup output in transcript), t1-batch4.txt
### C2 · Sign up accepts a whitespace-only name
- Check: AUTH-013 · Severity guess: S3 · Seen: 2/2
- Steps: POST /signup name=3 spaces, new email, password longenough1
- Expected: Name required/refused
- Actual: 302 /account, header reads "Hi    " (blank greeting)
- Evidence: as above (r2t1-ws, r2t1-ws2 accounts)
### C3 · Back button after Sign out shows the signed-in Account page
- Check: AUTH-013 · Severity guess: S4 · Seen: 1/1
- Steps: Sign in as A, visit /orders, /account, click Sign out, press browser Back
- Expected: Not signed-in content (or a redirect to /login)
- Actual: Back shows /account with "Hi Alex ... Sign out" (stale cached page); reload goes to /login. Responses carry no Cache-Control (only Content-Type).
- Evidence: qa/evidence/002/t1-p3.json (reads.back1), t1-account-headers.txt
## Charter notes
Covered: empty fields (signup -> password error; login -> generic error), missing/array/JSON-body login (generic error, no 500), 20k-char name and 3k-char email (no 500 observed; responses empty of error text, i.e. likely accepted/redirected, not examined further), unicode name (accepted), whitespace-only name/password at sign-up (C1, C2), parallel signup with same email x4 (exactly 1 account, 3 refused), parallel login x3 (all 302), hidden next tampering (javascript:, backslash host -> /), back button after sign out (C3), reload after back goes to /login. Browser double Enter submit not cleanly tested (first Enter navigates so the second timed out in the driver); not-run.
## Learned
- Driver expectUrl: a plain string with "/" followed by letters containing "/" is parsed as regex; use e.g. "//login[?]next=[/]orders/" style or check URL via eval.
- eval steps: avoid regex literals with backslashes in JSON plans.
- Git Bash curl needs MSYS_NO_PATHCONV=1 for values starting with "/" (next=/orders was mangled to /).
- A's order list also has #103 from earlier testers. HEAD requests return 404.
- Throwaway users left: r2t1-ws, r2t1-ws2, r2t1-wp, r2t1-wp2, r2t1-short?(not created), r2t1-par, r2t1-long/uni/longemail (maybe).
