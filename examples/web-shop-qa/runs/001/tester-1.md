# Run 001 · tester 1 · area: auth, account
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| AUTH-002 | fail 0/2 (desktop), fail 1/1 phone | Wrong password: "500 Internal Server Error" instead of "Incorrect email or password" (POST /login 500) | evidence/001/auth-002-fail.png, auth-002-phone-fail.png, auth-002-curl.txt | |
| AUTH-007 | fail 2/2 | Duplicate email signup not refused: 302 to /account, "Hi Dup". User A's original password still works; new password "longenough1" gives 500 | evidence/001/auth-007-curl.txt, auth-007-fail.png | |
| AUTH-009 | pass | After Sign out, /orders -> /login?next=/orders; header "Shop · Sign in · Sign up" | evidence/001/plans/auth-009b.json | |
| AUTH-003 | pass | "Incorrect email or password" shown for unknown email (200) | evidence/001/auth-003.txt | |
| AUTH-006 | pass | "Password must be at least 8 characters" | curl output (quoted) | |
| AUTH-008 | fail 2/2 | "not-an-email" accepted in browser and by curl; lands on /account "Hi Bad" | evidence/001/plans/auth-008.json (reads in run output) | |
| AUTH-010 | fail 2/2 | After POST /logout (302), old sid still gets /orders 200 showing "Order #101" | evidence/001/auth-010.txt | |
| AUTH-011 | pass | Same "Check your email / If that email has an account, we sent a reset link." for A and nobody@example.test | curl quoted | |
| AUTH-012 | pass | /orders -> login?next=/orders -> lands /orders showing #101 | evidence/001/plans/auth-012.json | |
| AUTH-004 | pass | Uppercase email + trailing space signs in (lands /) | evidence/001/plans/auth-004.json | |
| ACCT-002 | fail 2/2 | "Address saved" shown (?saved=1) but after reload address box value is "" | evidence/001/acct-002-after.txt | |
| ACCT-004 | fail 2/2 | Saved "9 Pine Close"; Ship to is empty at /checkout | evidence/001/acct-004-checkout.txt, acct-004-end.png | |
| ACCT-001 | pass | "Hi Blair", address "12 Oak Lane" | evidence/001/plans/acct-001.json | |
| ACCT-003 | pass | /account as guest -> /login?next=/account | evidence/001/plans/acct-003.json | |
| AUTH-013 | fail (charter) | see candidates C4, C5, C6 | evidence/001/auth-013-next.txt | |
## Candidates
### C1 · Wrong password shows a 500 error page instead of a message
- Check: AUTH-002 · Severity guess: S1 · Seen: 2/2 desktop + 1/1 phone (curl: same for user A, user B, empty password)
- Steps: Guest -> /login -> A's email, password "wrong-password" -> Sign in
- Expected: "Incorrect email or password", not signed in (source: AUTH-002)
- Actual: page "500 Internal Server Error", POST /login 500. Unknown email works (200, correct message), so only known emails break.
- Evidence: evidence/001/auth-002-fail.png, auth-002-curl.txt
### C2 · Signing up with an existing email is accepted
- Check: AUTH-007 · Severity guess: S1 · Seen: 2/2
- Steps: /signup, Name "Dup", A's email, password "longenough1" -> Create account
- Expected: refused, "already registered"; A unaffected (source: AUTH-007)
- Actual: 302 to /account "Hi Dup". A's original password still signs in, but the duplicate password then causes 500 on login for that email. Case-variant of A's email also accepted (302 /account). Possible A's data not visible to the new session (/orders showed no #101).
- Evidence: evidence/001/auth-007-curl.txt, auth-007-fail.png
### C3 · Signing out does not end the session
- Check: AUTH-010 · Severity guess: S1 · Seen: 2/2
- Steps: curl sign in as A, keep sid; POST /logout with it; GET /orders with the old sid
- Expected: redirect to /login (source: AUTH-010)
- Actual: logout 302 /, then /orders 200 "Your orders Order #101"
- Evidence: evidence/001/auth-010.txt
### C4 · Saved shipping address is lost
- Check: ACCT-002, ACCT-004 · Severity guess: S2 · Seen: 2/2 each
- Steps: sign up own user -> /account -> "Shipping address" "4 Elm Road, Springfield" -> Save address -> reload; also with "9 Pine Close", add mug, /checkout
- Expected: address persists and prefills "Ship to" (source: README features)
- Actual: "Address saved" but box and checkout "Ship to" are empty (input name=shipTo value=""). Seed address for user B displays fine.
- Evidence: evidence/001/acct-002-after.txt, acct-004-checkout.txt, acct-004-end.png
### C5 · Sign up accepts an invalid email
- Check: AUTH-008 · Severity guess: S3 · Seen: 2/2
- Steps: /signup, Email "not-an-email" -> Create account
- Expected: refused (source: AUTH-008)
- Actual: account created, lands on /account "Hi Bad". Email input type=email is absent on the form-level refusal; browser did not block either.
- Evidence: plans/auth-008.json
### C6 · Open redirect after sign in via the "next" field
- Check: AUTH-013 (hidden field tampering) · Severity guess: S2 · Seen: 2/2
- Steps: POST /login with valid A credentials and next=https://evil.test (also //evil.test)
- Expected: stays on the shop
- Actual: 302 to https://evil.test/ and http://evil.test/. Query-string ?next= is sanitised (redirects to /); only the body field is not.
- Evidence: evidence/001/auth-013-next.txt
### C7 · Checkout page script error (outside checks)
- Check: outside checks · Severity guess: S3 · Seen: 3/3
- Actual: console pageError "reviewCache is not defined" on /checkout (driver pageErrors)
- Evidence: acct-004 run output
### C8 · Blank/whitespace-only name and all-space password accepted (outside checks)
- Check: AUTH-013 · Severity guess: S3 · Seen: 1/1
- Actual: signup with name "  " and with password of 8 spaces both 302 /account. 5000-char name accepted too.
## Charter notes
Covered by curl and browser: empty fields (login/signup 200, handled), missing fields, 5000/20000-char values, unicode name/email, whitespace-only name and password, case-variant duplicate email, query and body "next" tampering, wrong password for several accounts. Not covered: double submit, back button after sign out (time).
## Learned
- Use MSYS_NO_PATHCONV=1 with curl in Git Bash when sending values starting with "/".
- Signup form POSTs to /signup; address form POSTs to /account/address, field name "address"; checkout field "shipTo".
- Driver locator "header" doesn't match the page header; use body text.
- A created user "Dup"/"Bad" and several qa-t1-* throwaway users exist on the shared server; the duplicate signup also leaves a second account under user A's email.
