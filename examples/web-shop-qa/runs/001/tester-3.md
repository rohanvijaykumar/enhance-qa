# Run 001 · tester 3 · area: ORD, SEC
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| ORD-005 | fail | A gets 200 and JSON with "Blair, 12 Oak Lane" for /api/orders/102 | evidence/001/ord-005.txt | |
| ORD-004 | pass | 404 "Order not found", no B details | evidence/001/ord-004.txt | |
| ORD-003 | pass | /orders 302 -> /login?next=/orders; /orders/101 302 -> /login; /api/orders/101 401 | evidence/001/ord-003.txt | |
| ORD-002 | pass | "Order #101", "Ship to: Alex, 4 Elm Road", "Total: $24.00" | evidence/001/ord-002.txt | |
| ORD-006 | pass | "No orders yet." for new user | evidence/001/ord-006.txt | |
| SEC-001 | fail | /admin as A (and a new customer) returns 200 listing all users' emails incl. user B | evidence/001/sec-001.txt | |
| SEC-002 | fail | Pages in app map clean, but /admin lists B's email; /api/orders/102 shows B's name+address | evidence/001/sec-002.txt, sec-001.txt | |
| SEC-003 | fail | Response contains literal `<b><b>bold</b><img src=x onerror=alert(1)></b>` unescaped | evidence/001/sec-003.html | |
| SEC-004 | fail | next value injected unescaped into hidden input (`value=""><script>alert(1)</script>">`); POST /login with next=https://example.com answers 302 Location: https://example.com | evidence/001/sec-004.html | |
| SEC-005 | fail | app.js line 2: STRIPE_SECRET_KEY = 'sk_test_...' (redacted), line 3 exposes it as paymentsKey | evidence/001/sec-005.txt | |
| SEC-006 | pass | both traversal URLs 404 "Not found" | evidence/001/sec6a.tmp | |
| SEC-007 | pass | Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax | evidence/001/sec-007.txt | |
| SEC-008 | pass | bad JSON -> 200 "Incorrect email or password"; 20k URL -> 431 bare; no traces/paths | evidence/001/sec-008a.txt, sec-008b.txt | |
| SEC-009 | pass-with-candidates | see Charter notes (reported as findings in C1-C5; no further S1-S3 beyond them) | | |
## Candidates
### C1 · Any signed-in customer can read other people's orders through the API
- Check: ORD-005 · Severity guess: S1 · Seen: 2/2
- Steps: sign in as user A (or any new user) -> GET /api/orders/102
- Expected: 404 or 403, no "Blair"/"12 Oak Lane" (source: README)
- Actual: 200 {"id":102,"userId":2,...,"shipTo":"Blair, 12 Oak Lane"}; a brand-new user also got #101 and #102
- Evidence: evidence/001/ord-005.txt
### C2 · Customers can open the admin page and see every user's email
- Check: SEC-001 (also SEC-002) · Severity guess: S1 · Seen: 2/2
- Steps: sign in as user A or a new user -> /admin
- Expected: refused (403/404/redirect) (source: checklist)
- Actual: 200, table of ID/Email/Role for all users. Guest gets 302.
- Evidence: evidence/001/sec-001.txt
### C3 · Search text is run as HTML (reflected XSS)
- Check: SEC-003 · Severity guess: S1 · Seen: 1/1 (response body inspected, script not executed in browser)
- Steps: GET /?q=<b>bold</b><img src=x onerror=alert(1)>
- Expected: shown literally (escaped) · Actual: tags appear raw inside "Results for <b>..."
- Evidence: evidence/001/sec-003.html
### C4 · Login "next" parameter injects script and allows off-site redirect
- Check: SEC-004 · Severity guess: S1 · Seen: 1/1
- Steps: /login?next="><script>alert(1)</script> and view source; POST /login with next=https://example.com and valid creds
- Expected: no injection, stay on site · Actual: raw script tag in page; 302 Location: https://example.com
- Evidence: evidence/001/sec-004.html
### C5 · Payment secret key is in the public JavaScript
- Check: SEC-005 · Severity guess: S1 · Seen: 1/1
- Steps: curl /static/app.js
- Expected: no secrets · Actual: `const STRIPE_SECRET_KEY = 'sk_test_...'` (first 8 chars shown)
- Evidence: evidence/001/sec-005.txt
### C6 · Terms page missing (outside checks)
- Check: outside checks · Severity guess: S3 · Seen: 1/1
- Steps: footer link "Terms" -> /terms · Expected: page · Actual: 404
- Evidence: evidence/001/sec-002.txt
### C7 · Nothing for oversize URL shown nicely (outside checks)
- Check: outside checks · Severity guess: S4 · Seen: 1/1
- Actual: 20k-char path returns bare 431 with no body (acceptable; noted only)
## Charter notes
Covered with throwaway user qa-t3-*: address field with script text (POST /account returned 404, so the form path or method differs; not verified further), cart add with qty -5 (clamped to 1), cart remove with unknown productId (302, no error), POST /orders and POST /admin (404), /api/orders ids of other users (readable, C1), /admin (C2). Did not modify user A or B data. Not covered: account address stored-XSS via the real form route, cart/update with other users' product IDs, checkout ship-to tampering.
## Learned
- Git Bash mangles curl -w strings starting with "/"; avoid.
- Login is a form POST (email, password, next); new users can sign up with name,email,password.
- /api/products is public JSON; /admin is open to any signed-in user.
