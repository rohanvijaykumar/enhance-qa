# Verifier 1 · run 2 · build 5 · Job 1 (reproduce)
Throwaway users r2v1-*@example.test (passwords not recorded). All carts emptied afterwards. Driven with curl (cookie jars in evidence) and drive-web.mjs.

### C1
- Log: 2026-11-16 · build 5 · Reproduced 3/3 (S3 likely, wording call). Qty 3 mug: cart Total $36.00 and "Cart (3)" are right, but the mug row's Price column shows $12.00 (unit price), not the line amount $36.00. Evidence: evidence/002/v1-c1t{1,2,3}.cart.html
- Verdict: Reproduced 3/3
- Minimal steps: sign up, POST /cart/add productId=1, POST /cart/update productId=1&qty=3, GET /cart. Column header is "Price", so $12.00 may be a deliberate unit price; the expectation (line amount) comes from CART-003. Lead should check that spec wording. Not tried with qty 2 or in browser (server-rendered HTML, same result).

### C2
- Log: 2026-11-16 · build 5 · Reproduced 3/3 (S2 likely). qty=99999999999999999999 gives "Total: $1.2e+21", "Cart (100000000000000000000)" and qty input 100000000000000000000. Evidence: evidence/002/v1-c2t{1,2,3}.cart.html
- Verdict: Reproduced 3/3
- Minimal steps: POST /cart/update productId=1&qty=99999999999999999999 with a mug in cart, GET /cart. Done via direct POST, not the browser number field.

### C3
- Log: 2026-11-16 · build 5 · Reproduced 3/3 (S3 likely). Sign up with a password of 8 spaces is accepted (302 to /account). Evidence: evidence/002/v1-c3t{1,2,3}.html
- Verdict: Reproduced 3/3
- Minimal steps: POST /signup name="R2V1 Test", new email, password=8 spaces.

### C4
- Log: 2026-11-16 · build 5 · Reproduced 3/3 (S3 likely). Sign up with name "   " is accepted (302 to /account); /account then shows the heading "Hi" followed by blanks. Evidence: evidence/002/v1-c4t{1,2,3}.account.html
- Verdict: Reproduced 3/3
- Minimal steps: POST /signup name="   ", new email, valid password; GET /account.

### C5
- Log: 2026-11-16 · build 5 · Reproduced 1/1 in Chrome (S3 likely). After sign in, /account, Sign out, Back, the signed-in Account page ("Hi R2V1 Five", Sign out button) is shown again. /account sends no Cache-Control header. Evidence: evidence/002/v1-c5-end.png, v1-c5.plan.json, v1-c5.headers.txt
- Verdict: Reproduced 1/1
- Caveat: only one try (plan run once); the page may be served from the browser back/forward cache. I did not check whether a reload then redirects to /login (the user's password was not kept), so whether the session truly ended after logout is unconfirmed here.

### C6
- Log: 2026-11-16 · build 5 · Reproduced 1/1 (S3 likely). At 390x844, searching for "a"x600 gives documentElement.scrollWidth 5186 vs clientWidth 390 (horizontal scroll). Evidence: evidence/002/v1-c6-end.png, v1-c6.plan.json
- Verdict: Reproduced 1/1
- Single run; deterministic layout with a long unbroken word.

### C7
- Log: 2026-11-16 · build 5 · Reproduced 3/3 by repeat request (S3 likely). GET /?q=%20mug%20 shows "No products match your search."; q=mug lists Ceramic mug. Evidence: output in this session only (not saved to file).
- Verdict: Reproduced
- Minimal steps: search " mug " with spaces.
