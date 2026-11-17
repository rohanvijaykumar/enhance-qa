---
run: 2
mode: check
build: 5
commit: bc0c4bfc6d9f
head: 7b9f36a461ff
tree: 90d79b465338
started: 2026-11-16T23:30
finished: 2026-11-17T00:05
budget: standard
verdict: Not ready — 1 S1 bug (BUG-005, secret key in public JS) waits on your decision
interrupted: no
progress: all phases done (intake, test 4/4 batches + spot audit, confirm, triage, verify BUG-002, report); no fixing (nothing at the fix-now bar)
---
# Run 002 · check · build 5

## Scope
Check pass from build 1 (last tested) to build 5. Changed: server.js, static/app.js, static/style.css → areas shop, cart, checkout, auth, account, orders, content.
- Fix to verify: BUG-002 (fixed by the user's own coding agent, uncommitted in server.js).
- 70 agent checks + 1 auto (smoke, changed areas, regression checks added in run 1, 10% rotation). Human: PAGE-004 (prepared, not run).
- Estimate ≈ $2.94 API-equivalent, ~37 min; above confirm_over_usd ($2) but non-interactive, so the announced scope runs.
Environment: local server `node server.js` on http://localhost:4310, Chrome via Playwright, Windows 11.
Uncommitted product files included in the snapshot: server.js (modified: /admin role check for BUG-002, and a change to the cart line-price cell). Plus .gitignore and qa tooling, not product files.


## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| A11Y-001 | pass | All visible inputs named (login, signup, reset, cart Quantity for X, checkout Ship to, account Shipping address) | evidence/002/t4-phone.txt |  |
| A11Y-002 | pass | Tab order Shop, Sign in, Sign up, Email, Password, Sign in button; default focus outline (auto 1px); Enter signed in | evidence/002/t4-kbd.txt, t4-kbd2.txt |  |
| A11Y-004 | pass | 390 wide: /, product, login, cart (2 items), checkout, account all scrollWidth 390; 0 buttons/links past right edge | evidence/002/t4-phone.txt |  |
| A11Y-005 | pass | 390x844 scrollWidth 390 with 1 and 2 items; at 1280 one table | evidence/002/t4-phone.txt, t4-phone-t4-phone-cart2.png |  |
| ACCT-001 | pass | "Hi Blair", address value 12 Oak Lane | evidence/002/t3-ACCT-box.txt |  |
| ACCT-002 | pass | "Address saved"; reload value="4 Elm Road, Springfield" | evidence/002/t3-ACCT-002.txt |  |
| ACCT-003 | pass | 302 /login?next=/account | evidence/002/t3-ACCT-etc.txt |  |
| ACCT-004 | pass | A saved 9 Pine Close, checkout prefilled | evidence/002/t3-ACCT-etc.txt |  |
| ACCT-005 | pass | New user: box 9 Pine Close after reload, checkout prefilled | evidence/002/t3-ACCT-etc.txt |  |
| AUTH-001 | pass | 9/9 steps; landed on / with Sign out, Account, Orders, Cart in header | evidence/002/AUTH-001.result.json |  |
| AUTH-002 | pass | 200, "Incorrect email or password", no sid set | evidence/002/t1-batch1.txt |  |
| AUTH-003 | pass | Same message | evidence/002/t1-batch3.txt |  |
| AUTH-004 | pass | CAPS email + trailing space + right password -> 302 / with sid | evidence/002/t1-batch3.txt |  |
| AUTH-005 | pass | 8/8; landed on /account, "Hi QA New" and "Sign out" shown. Created throwaway user qa-new-20261116a@example.test | evidence/002/AUTH-005.result.json |  |
| AUTH-006 | pass | "Password must be at least 8 characters"; login with that email fails | evidence/002/t1-batch3.txt |  |
| AUTH-007 | pass | Refused; A's own password signs in; sees #101 (and #103, another tester's order); Dup's password longenough1 rejected for A | evidence/002/t1-batch1.txt |  |
| AUTH-008 | pass | "Enter a valid email address" | evidence/002/t1-batch3.txt |  |
| AUTH-009 | pass | Browser: sign out then /orders -> /login?next=/orders, header "Sign in"; curl same | evidence/002/t1-p2.json, t1-batch3.txt |  |
| AUTH-010 | pass | Old sid: /orders 302 /login, /api/orders/101 401 | evidence/002/t1-batch3.txt |  |
| AUTH-011 | pass | Identical "Check your email" page for A and nobody@ | evidence/002/t1-batch3.txt |  |
| AUTH-012 | pass | /orders -> /login?next=/orders -> sign in -> /orders | evidence/002/t1-p2.json |  |
| AUTH-013 | fail | Charter: whitespace-only password and name accepted; Back after sign out shows Account page | evidence/002/t1-p3.json, t1-batch4.txt | BUG-024, BUG-025, BUG-026 |
| AUTH-014 | pass | No script tag (escaped in hidden input). next=https://example.com -> Location /; //evil.test -> /; /orders -> /orders (needed MSYS_NO_PATHCONV=1) | evidence/002/t1-batch1.txt, t1-batch2.txt |  |
| AUTH-015 | pass | Desktop (curl) and 390x844 (browser): error shown, not signed in | evidence/002/t1-auth015-phone.png, t1-batch1.txt |  |
| AUTH-016 | pass | "An account with this email already exists" for exact and CAPS+trailing space; A signs in, sees #101 | evidence/002/t1-batch1.txt |  |
| AUTH-017 | pass | 302 Location /login?next=/orders with old sid | evidence/002/t1-batch1.txt |  |
| AUTH-018 | pass | "Enter a valid email address" for not-an-email and a@b | evidence/002/t1-batch1.txt |  |
| CART-001 | pass | 16/16; "Cart (1)", "Total: $12.00", qty read as "1". Cleanup: clicked Remove, "Your cart is empty", "Cart (0)" | evidence/002/CART-001.result.json |  |
| CART-002 | fail 2/2 | One row, qty input 2, "Cart (2)" and Total $24.00 match. The row shows "$12.00", so "$24.00" appears only as the total, not on the row. · disagreement: tester-5 fail, tester-2 pass | qa/evidence/002/t5-CART-002b.json, qa/evidence/002/t5-CART-002d.json, qa/evidence/002/t5-CART-002d-end.png | BUG-022 |
| CART-003 | fail 2/2 | Qty input shows 3 and Total $36.00 and "Cart (3)" match, but the Ceramic mug row shows "$12.00" (unit price), not a line of $36.00. · disagreement: tester-5 fail, tester-2 pass | qa/evidence/002/t5-CART-003.json, qa/evidence/002/t5-CART-003d.json, qa/evidence/002/t5-CART-003d-end.png | BUG-022 |
| CART-004 | pass | qty -2 ignored (stays 3); qty 0 removes item, Total $0.00 | evidence/002/t2-cart-a.txt |  |
| CART-005 | fail | blank/abc/1.5 fine (qty kept), but qty=99999999999999999999 gives Total $1.2e+21 and Cart (100000000000000000000) | evidence/002/t2-cart-b.txt | BUG-023 |
| CART-006 | pass | Remove spoon: only mug, $12.00, Cart (1) | evidence/002/t2-cart-a.txt |  |
| CART-007 | pass | "Your cart is empty.", Total: $0.00, Cart (0) | evidence/002/t2-cart-a.txt |  |
| CART-008 | pass | Linen tea towel not in cart | evidence/002/t2-cart-a.txt |  |
| CART-009 | blocked | waiting on a question. Observed: Walnut spoon (stock 3) qty 10 accepted: Cart (10), Total $180.00 | evidence/002/t2-cart-c.txt |  |
| CART-010 | pass | Guest add -> 302 /login?next=/cart | evidence/002/t2-cart-c.txt |  |
| CART-011 | pass | A has mug, B cart empty; A cart cleared after | evidence/002/t2-cart-b.txt |  |
| CART-012 | fail | Charter (curl only): huge quantities accepted, no upper bound | evidence/002/t2-cart-c.txt, t2-cart-d.txt | BUG-023 |
| A11Y-003 | pass | auto: `<html lang="en"` | curl output (quoted) |  |
| CART-013 | pass | -2, empty, abc all leave qty 1, $12.00 | evidence/002/t2-cart-a.txt |  |
| CART-014 | pass | Continue shopping link present, no "undefined" | evidence/002/t2-cart-a.txt |  |
| CART-015 | pass | productId=2 not added | evidence/002/t2-cart-a.txt |  |
| CART-016 | pass | 999 and abc: /cart 200, /checkout 200, nothing added | evidence/002/t2-cart-a.txt |  |
| CHK-001 | pass | 15/15; "Thank you!", "is confirmed. Total $12.00.", order ref read as "Order #103", "Cart (0)" after. Creates a real test-mode order for user A | evidence/002/CHK-001.result.json |  |
| CHK-002 | pass | Cart Total $42.00, checkout Total $42.00 | evidence/002/t3-money1.txt |  |
| CHK-003 | pass | "Your cart is empty. Continue shopping", no shipTo form | evidence/002/t3-ACCT-etc.txt |  |
| CHK-004 | pass | Empty shipTo not placed, message shown; input has `required` | evidence/002/t3-CHK-005-008.txt |  |
| CHK-005 | pass | B checkout input shipTo value="12 Oak Lane" | evidence/002/t3-CHK-005-008.txt |  |
| CHK-006 | pass | After order #105 ($42.00), Orders lists "Order #105 · $42.00"; cart Cart (0). (Order #101 is A's; not in this fresh user's list, by design) | evidence/002/t3-CHK-006.txt |  |
| CHK-007 | pass | money tour, no wrong amounts found; see charter notes | evidence/002/t3-money1.txt, t3-money2.txt |  |
| CHK-008 | pass | shipTo empty and "   " -> 200 "Please enter a Ship to address", no order | evidence/002/t3-CHK-005-008.txt |  |
| ORD-001 | pass | 9/9; "Order #101 · $24.00" listed, "Order #102" absent (the list also includes #103 from CHK-001) | evidence/002/ORD-001.result.json |  |
| ORD-002 | pass | "Order #101 Ship to: Alex, 4 Elm Road Total: $24.00" | evidence/002/t3-ACCT-etc.txt |  |
| ORD-003 | pass | /orders 302 /login?next=/orders; /orders/101 302 /login; /api/orders/101 401 | evidence/002/t3-ORD-003.txt |  |
| ORD-004 | pass | A /orders/102 -> 404 "Order not found", no Blair/Oak Lane | evidence/002/t3-ORD-003-004.txt |  |
| ORD-005 | pass | A GET /api/orders/102 -> 404 {"error":"Not found"} | evidence/002/t3-ORD-005-007.txt |  |
| ORD-006 | pass | "No orders yet." | evidence/002/t3-ACCT-etc.txt |  |
| ORD-007 | pass | A->102 404, B->101 404, A->101 200 with order #101 | evidence/002/t3-ORD-005-007.txt |  |
| PAGE-001 | fail | Footer Terms link: /terms 404 "Page not found" (Pricing, Privacy 200). Retry via curl: 404 again (2/2) | evidence/002/t4-guest.txt | BUG-015 |
| PAGE-005 | pass | "Shipping is free on orders over $50. Receive your order in 3–5 working days." | evidence/002/t4-guest.txt |  |
| SEC-001 | pass | User A GET /admin: 404 "Page not found", no emails (guest gets 302) | evidence/002/t4-sec001.txt | BUG-002 |
| SEC-010 | pass | Name, account page and order #107 "Ship to" all literal text; 0 b/i/img elements | evidence/002/t4-sec010.txt, t4-sec010b.txt |  |
| SHOP-001 | pass | 10/10; HTTP 200 on /; 3 li.product; prices $12.00, $9.50, $18.00 found; no pageErrors/console in the result (the driver lists them only when present) | evidence/002/SHOP-001.result.json |  |
| SHOP-002 | pass | Row "Linen tea towel · $9.50 Out of stock"; /product/2 "Out of stock", 0 buttons | evidence/002/t4-guest.txt |  |
| SHOP-003 | pass | 7/7; URL /?q=mug; "Results for mug"; exactly 1 li.product; "Walnut spoon" absent | evidence/002/SHOP-003.result.json |  |
| SHOP-005 | pass | /?q=zzzz: "No products match your search.", 0 li.product | evidence/002/t4-guest.txt |  |
| SHOP-007 | pass | 5/5; /product/1 titled "Ceramic mug · Corner Shop"; $12.00 and Add to cart visible; no pageErrors/console in the result | evidence/002/SHOP-007.result.json |  |
| SHOP-011 | fail | Charter: long search word scrolls sideways at phone width; " mug " finds nothing; search box empties (BUG-016); Terms 404 (BUG-015) | evidence/002/t4-charter.txt, t4-charter2.txt | BUG-027, BUG-028 |
| SHOP-012 | pass | Raw HTML shows &lt;b&gt;...escaped; no injected img | evidence/002/t4-shop012.html |  |
| SHOP-013 | pass | /product/1 and /3: no pageErrors/console; reviews show "0 reviews" | evidence/002/t4-guest.txt |  |
## Bugs
- New (7): S3 BUG-022 (needs-decision), BUG-023, BUG-024, BUG-025, BUG-026 · S4 BUG-027, BUG-028
- Fixed and verified (1): BUG-002 (fixed by the user's own coding agent, uncommitted in server.js; verified on build 5). Regression check added: SEC-011
- Still open: BUG-005 (S1, needs-decision), BUG-015 (S3, needs-decision; seen again in PAGE-001), BUG-016 (S4, seen again in the SHOP-011 charter)
- Fixing: none this run. No new bug reached the fix-now bar (S1/S2); BUG-022 comes from the user's own uncommitted cart edit and may be intended.
- Not filed: nothing; every candidate reproduced.

## Exploratory notes
- AUTH-013 (sign-in edge cases): covered back button after sign out (BUG-026), whitespace-only name and password (BUG-024, BUG-025), parallel double submit with curl (4 parallel signups with one email created one account; fine), very long name/email (no 500). Not covered: double submit by clicking in a real browser.
- CART-012 (money tour, cart): curl only. Found huge/unbounded quantities (BUG-023). Not covered: back button, two tabs, rapid clicks in a real browser, phone width.
- CHK-007 (money tour, checkout): totals agreed across cart, checkout, confirmation, order page and API for orders #105 ($42.00) and #106 ($72.00). Curl only; no back button / two tabs.
- SHOP-011 (browse/search, incl. 390x844 in the browser): long search word overflow (BUG-027), trimmed search (BUG-028), BUG-015 and BUG-016 still present. No page errors.

## Signal
Spot audit (tester 5, 6 passes re-run in the browser): 4 agreed, 2 disagreed. Tester 2 passed CART-002 and CART-003 after checking only the totals; the audit and verifier 1 showed the row amount is wrong (BUG-022). Both results recorded as fail. Tester 2's other cart passes involve totals/counts only and agree with testers 3 and 5. 7 of 7 candidates reproduced and filed.
Separation: testers and verifiers were separate black-box subagents; no fixer ran.

## Cost
| Role | Model | Agents | Tokens (total) | ≈ Cost |
|---|---|---|---|---|
| Lead | session (opus) | 1 | ~150k | ~$1.50 |
| Testers | haiku ×2, sonnet ×4 | 6 | 412k | ~$1.30 |
| Verifiers | sonnet | 2 | 108k | ~$0.40 |
| Total | | 9 | ~670k | ≈ $3.20 (estimate was ~$2.94) |

## Needs you
- [ ] BUG-005 (S1) A Stripe secret key (sk_test_…) is in the public static/app.js. OK to remove it from the client (recommended)? Rotate it in Stripe if it was ever a real key.
- [ ] BUG-022 Your uncommitted server.js edit makes cart rows show the unit price ($12.00) instead of the line amount ($36.00 for 3). Restore the line amount (recommended), or add a separate unit-price column, or is unit price intended?
- [ ] BUG-015 The footer "Terms" link is a 404. Send the Terms text to publish (recommended), approve a short placeholder, or remove the link?
- [ ] CART-009 A cart quantity above stock (10 Walnut spoons, stock 3) is accepted. Cap at stock (recommended), refuse with a message, or allow back-orders? (The answer also settles BUG-023's upper limit.)
- [ ] BUG-016 The search box empties after searching. Keep the query in the box (recommended), or by design?
- [ ] New wording added by run 1's fixes: "An account with this email already exists", "Enter a valid email address", "Please enter a Ship to address", "Your cart is empty. Continue shopping", "0 reviews". OK, or reword?
- [ ] PAGE-004 (human, ~3 min): open http://localhost:4310 at desktop and phone width, browse a product, the cart and checkout. Does it look tidy and read well?

## Not covered
- Firefox and WebKit/Safari, real phones (PAGE-004 human check).
- Browser back button / two tabs in cart and checkout (CART-012, CHK-007 charters ran with curl).
- Password-reset email delivery (no mail system).

## Verdict
Not ready — 1 S1 bug (BUG-005, secret key in public JS) waits on your decision.
