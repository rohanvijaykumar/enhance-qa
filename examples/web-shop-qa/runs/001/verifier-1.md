## Verifier 1 notes, run 001, build 1 (curl output: evidence/001/v1-curl-out.txt; browser: v1-c1-end.png, v1-c2-fail.png)

### C1
- Log: 2026-11-16 · build 1 · Reproduced 1/1. Guest /product/1 renders, but the console throws pageError "reviewCache is not defined" (client static/app.js loadReviews). Chrome desktop 1280x800. Evidence: evidence/001/v1-c1-out.txt, v1-c1-end.png
- Also seen (not a candidate): /static/app.js ships a hard-coded key constant starting "sk_test_" (first 8 chars) to every browser.
- Verdict: Reproduced 1/1 (S2 likely)

### C2
- Log: 2026-11-16 · build 1 · Reproduced 3/3. Wrong password for user A returns HTTP 500 "500 Internal Server Error", not "Incorrect email or password" (curl x3, browser x1). Also 500 for user B. Unknown email returns 200 (fine). Evidence: evidence/001/v1-c2-fail.png, v1-curl-out.txt
- Minimal: POST /login with a registered email + wrong password.
- Verdict: Reproduced 3/3 (S2 likely)

### C3
- Log: 2026-11-16 · build 1 · Reproduced 1/1. Signup with user A's existing email is accepted: 302 to /account, new session, page says "Hi Dup". No "already registered" message. User A can still log in afterwards (a duplicate-email account now exists). Evidence: evidence/001/v1-curl-out.txt (output captured in the transcript)
- Verdict: Reproduced 1/1 (S2 likely). Side effect: a "Dup" account with A's email exists in memory.

### C4
- Log: 2026-11-16 · build 1 · Reproduced 2/2. After POST /logout (302), the old sid still gets 200 on /orders ("Your orders / No orders yet") and /account, no redirect to /login. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 2/2 (S2 likely; session not invalidated server-side)

### C5
- Log: 2026-11-16 · build 1 · Reproduced 2/2. After POST /account/address "9 Pine Close" (302), /account shows `<input name="address" value="">` (empty); /checkout shipTo is `value=""` after adding the mug. Address not persisted or prefilled. Evidence: evidence/001/v1-curl-out.txt
- Not tried in the browser UI (same form fields via curl).
- Verdict: Reproduced 2/2 (S2 likely)

### C6
- Log: 2026-11-16 · build 1 · Reproduced 1/1. Signup with email "not-an-email" returns 302 to /account with a new session; no validation. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 1/1 (S3 likely)

### C7
- Log: 2026-11-16 · build 1 · Reproduced 1/1 for both parts. (a) /login?next="><script>alert(1)</script> renders `<input type="hidden" name="next" value=""><script>alert(1)</script>">` (unescaped, script tag injected; reflected XSS). (b) POST /login with user A's valid credentials and next=https://example.com returns 302 Location: https://example.com (open redirect). Not run in a browser to see the alert fire. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 1/1 (S1 likely for (a), S2 likely for (b))

### C8
- Log: 2026-11-16 · build 1 · Reproduced 1/1. After removing the only item, /cart shows "Your cart undefined" instead of "Your cart is empty"; total $0.00. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 1/1 (S3 likely)

### C9
- Log: 2026-11-16 · build 1 · Reproduced 1/1. Setting qty -2 gives a header count "Cart ( -2 )", line price "$-24.00", Total "$-24.00", and the qty input shows -2. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 1/1 (S2 likely)

### C10
- Log: 2026-11-16 · build 1 · Reproduced 2/2. qty= (empty) and qty=abc each give 302, then cart count "NaN", price "$NaN", Total "$NaN". No error page. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 2/2 (S2 likely)

### C11
- Log: 2026-11-16 · build 1 · Reproduced 1/1. POST /cart/add productId=2 (out of stock) returns 302 and the Linen tea towel appears in /cart with $9.50 and total $9.50. Evidence: evidence/001/v1-curl-out.txt
- Verdict: Reproduced 1/1 (S2 likely)
