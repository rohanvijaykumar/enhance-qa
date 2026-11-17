### C12
- Log: 2026-11-16 · build 1 · Reproduced 2/2. POST /cart/add productId=999 returns 302, then GET /cart and GET /checkout both return 500 (Error page) for that user. Evidence: evidence/001/v2-c12-cart.html, v2-c12-checkout.html
- Verdict: Reproduced 2/2 (S2 likely; the user's cart is broken until the cart is cleared)

### C13
- Log: 2026-11-16 · build 1 · Reproduced 1/1. User A GET /api/orders/102 returns 200 with user B's order JSON (userId 2, items, total 18, shipTo "Blair, 12 Oak Lane"). Evidence: evidence/001/v2-c13.html
- Verdict: Reproduced 1/1 (S1 likely)

### C14
- Log: 2026-11-16 · build 1 · Reproduced 1/1. User A GET /admin returns 200 with an Admin table listing user IDs, emails and roles of other users. Evidence: evidence/001/v2-c14.html
- Verdict: Reproduced 1/1 (S1 likely)

### C15
- Log: 2026-11-16 · build 1 · Reproduced 1/1. /?q=<b>bold</b><img src=x onerror=alert(1)> returns the query unescaped inside "Results for <b>...</b>". In Chrome an `<img>` and a nested `<b>` are in the DOM (the browser requested /x, a 404). The search input value is empty. I did not capture an alert dialog; the raw HTML is injected, so script execution is likely. Evidence: evidence/001/v2-c15.html, v2-c15-page.png
- Verdict: Reproduced 1/1 (S1 likely, reflected XSS)

### C16
- Log: 2026-11-16 · build 1 · Reproduced 1/1. GET /static/app.js contains `SECRET_KEY = '[REDACTED:stripe-key]...` (first 8 chars sk_test_) and uses it. Evidence: quoted output only (value truncated).
- Verdict: Reproduced 1/1 (S1 likely)

### C17
- Log: 2026-11-16 · build 1 · Reproduced 1/1. The footer "Terms" link points to /terms, which returns 404 "Page not found". Evidence: evidence/001/v2-c17.html
- Verdict: Reproduced 1/1 (S2 likely)

### C18
- Log: 2026-11-16 · build 1 · Reproduced 1/1. /?q=mug shows results, but the Search input is `<input name="q" value="">` (empty). Evidence: evidence/001/v2-c18.html
- Verdict: Reproduced 1/1 (S3 likely; the convention is assumed)

### C19
- Log: 2026-11-16 · build 1 · Reproduced 1/1. /pricing text reads "Recieve your order in 3-5 working days" (should be "Receive"). Evidence: evidence/001/v2-c19.html
- Verdict: Reproduced 1/1 (S3 likely)

### C20
- Log: 2026-11-16 · build 1 · Reproduced 1/1. At 390x844, /cart with Ceramic mug has documentElement.scrollWidth 620 vs 390, so the page scrolls horizontally. Evidence: evidence/001/v2-c20-cart.png
- Verdict: Reproduced 1/1 (S2 likely)

### C21
- Log: 2026-11-16 · build 1 · Reproduced 1/1. POST /checkout with shipTo= (empty) returns 200 and creates order #103 ($12.00); it appears in /orders. Evidence: evidence/001/v2-c21.html
- Verdict: Reproduced 1/1 (S2 likely)
