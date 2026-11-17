## Verifier 4 notes (run 001, build 2)
Method: curl with throwaway users (qa-v4-*), plus drive-web (Chrome) for pages. Tests: none in project; git diff 9ea795f 41a7805 --stat shows no test files; tamper-tests flagged nothing. Evidence: qa/evidence/001/v4-b2-*.png (phone cart 1 and 2 items, empty, desktop cart).

### BUG-009
- Log: 2026-11-16 · build 2 · Verified. Address "9 Pine Close" persists after reload of /account and prefills Ship to at checkout (2/2, new users). Variants: changed again ("1 New St" persisted); quotes/&/<b> address round-trips HTML-escaped in both boxes. Halo ACCT-001 (Hi Blair, 12 Oak Lane), CHK-005 (B: Ship to 12 Oak Lane; cart undone), CHK-001 (order #103 placed, Thank you, total $12.00): pass.
- Verdict: Verified

### BUG-010
- Log: 2026-11-16 · build 2 · Verified. qty -2 leaves qty 1 / $12.00 (2/2); empty qty and "abc" and 2.5 rejected (qty 1 stays, no NaN); qty 0 removes the item (Your cart is empty, $0.00, Cart (0)); qty 3 gives $36.00, checkout total $36.00. Halo CART-002 (qty 2 $24.00), CART-003, CART-006, CHK-002 ($42.00): pass. No NaN/undefined on cart or checkout.
- Verdict: Verified

### BUG-011
- Log: 2026-11-16 · build 2 · Verified. Removing the only item shows "Your cart is empty", Total $0.00, Cart (0), no "undefined" (2/2). Variant: phone 390x844 remove of both items shows empty state (v4-b2-p18-empty.png). Halo CART-006, CHK-003 (checkout shows empty message, no form): pass.
- Verdict: Verified

### BUG-012
- Log: 2026-11-16 · build 2 · Verified. POST /cart/add productId=2 leaves cart empty, Cart (0) (2/2). Halo CART-001 (mug adds, qty 1, $12.00), CART-002, SHOP-002 (not rechecked in UI beyond cart; add rejected): pass.
- Verdict: Verified

### BUG-013
- Log: 2026-11-16 · build 2 · Verified. productId=999 ignored; /cart and /checkout both 200 with empty-cart messages (2/2, fresh users). Variants abc, missing, empty productId: same. Halo CART-001: pass.
- Verdict: Verified

### BUG-014
- Log: 2026-11-16 · build 2 · Verified. /product/1 (x2) and /product/3 as guest: no page errors, no "Loading reviews" left after 1.5s. Halo SHOP-007 (no script errors), SHOP-008 (/product/999 404 "Product not found"): pass. Note: SHOP-002 button absence not visually checked.
- Verdict: Verified

### BUG-017
- Log: 2026-11-16 · build 2 · Verified. /pricing reads "Receive your order in 3-5 working days"; no misspellings found (2/2). Halo PAGE-003: title "Pricing · Corner Shop": pass (other page titles not checked).
- Verdict: Verified

### BUG-018
- Log: 2026-11-16 · build 2 · Verified. At 390x844 scrollWidth is 390 on /cart with 1 item, 2 items, empty, plus / and /checkout (2/2). Desktop 1280x800: scrollWidth 1280, cart is display:table. Halo A11Y-004: no horizontal scroll, buttons visible and tappable on cart/checkout/home: pass. Evidence: v4-b2-p18-cart2.png.
- Verdict: Verified

### BUG-019
- Log: 2026-11-16 · build 2 · Verified. POST /checkout with shipTo empty, "  " and tab/newline: no order placed, re-shows "Please enter a Ship to address", orders list empty, cart kept (2/2). Halo CHK-001 (order #107, $12.00, in Orders, Cart (0)), CHK-004, CHK-006: pass. Empty cart + empty shipTo: 302, no order.
- Verdict: Verified
