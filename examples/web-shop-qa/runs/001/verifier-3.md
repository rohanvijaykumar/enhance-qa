# Verifier 3 notes, run 001, build 2 (Job 2 + one Job 1 candidate)
Tamper review (all bugs): no test files in `git diff 9ea795f 41a7805 --stat`; `qa tamper-tests --since 1`: no flags. Evidence prefix: qa/evidence/001/v3-b2-*. Checked pages: no 500s or script errors.

### BUG-001
- Log: 2026-11-16 · build 2 · Verified. A->/api/orders/102 gives 404 {"error":"Not found"} (2/2). Variants: B->101 404, A->101 and B->102 return own order, A page /orders/102 404, A's list shows only #101. Halo ORD-001, ORD-003 (guest API 401, pages 302 to /login), ORD-004: pass. Tests: none touched. Evidence: evidence/001/v3-b2-bug001.txt, v3-b2-b3-4.txt
- Verdict: Verified

### BUG-003
- Log: 2026-11-16 · build 2 · Verified. q=<b>bold</b><img src=x onerror=alert(1)> renders escaped text in "Results for" (2/2). Variants: quotes, &, <script> all escaped. Halo SHOP-003, SHOP-004, SHOP-005: pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-4.txt. Side observation (not part of this bug): the search box value is empty even after searching "mug" (SHOP-006 expects it kept); I did not check build 1.
- Verdict: Verified

### BUG-004
- Log: 2026-11-16 · build 2 · Verified. (a) next="><script>..  is escaped in the hidden input, no script injected; (b) next=https://example.com redirects to / (2/2). Variants: //evil.test, /\evil.test, http://localhost:4310.evil.test all go to /; next=/orders lands on /orders. Halo AUTH-001, AUTH-012 (login?next=/orders carries next, sign-in lands on /orders), CART-010 (guest add to cart 302 to /login?next=/cart): pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-4.txt
- Verdict: Verified

### BUG-006
- Log: 2026-11-16 · build 2 · Verified. Wrong password shows "Incorrect email or password", status 200, no session cookie (2/2: curl and browser). Variants: user B, empty password, unknown email, phone 390x844 (no horizontal overflow, /orders still redirects to /login): pass. Halo AUTH-001 (302 to /, cookie set), AUTH-003, AUTH-004: pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-678.txt, v3-b2-bug006-phone-end.png
- Verdict: Verified

### BUG-007
- Log: 2026-11-16 · build 2 · Verified. Sign up with user A's email shows "An account with this email already exists", no session (2/2). Variant: email in capitals with spaces also refused. User A still signs in with the original password (not with longenough1) and sees Order #101. Halo AUTH-005 (new user lands on /account), AUTH-006 (short password message): pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-678.txt
- Verdict: Verified

### BUG-008
- Log: 2026-11-16 · build 2 · Verified. After POST /logout, old sid on /orders gives 302 to /login?next=/orders (2/2); /account 302, /api/orders/101 401 too. Halo AUTH-009 (logout clears cookie), SEC-007 (HttpOnly; SameSite=Lax): pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-678.txt
- Verdict: Verified

### BUG-020
- Log: 2026-11-16 · build 2 · Verified. Signup with "not-an-email" shows "Enter a valid email address" (2/2). Variants: "a@b" and empty refused; "a@b.c" accepted (my test created that stray account). "not-an-email" cannot sign in, so no account was created. Halo AUTH-005, AUTH-008: pass. Tests: none touched. Evidence: evidence/001/v3-b2-b3-678.txt
- Verdict: Verified

### C22
- Log: 2026-11-16 · build 2 · Reproduced 3/3 (browser once, curl twice). Stored HTML injection: Name `<b>x</b><img src=x>` renders unescaped in /account heading (`<h1>Hi <b>x</b><img src=x></h1>`), and checkout Ship to `<i>ship</i><img src=y>` renders unescaped on /orders/<id> ("Ship to: <i>ship</i><img src=y>"). Not affected: saved Shipping address `<b>addr</b>` is escaped (input value and prefilled checkout field). The checkout confirmation and orders list show no user text. Minimal steps: sign up with the name above, GET /account; or add mug, POST /checkout with that shipTo, GET /orders/<id>. Likely S2 (script payloads are stored the same way, I did not try one). Order of my inspection did not affect it (the same in curl and Chrome). Evidence: evidence/001/v3-b2-c22.txt, v3-b2-c22-curl.txt, v3-b2-c22-end.png
- Verdict: Reproduced 3/3
