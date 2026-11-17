# Run 002 · tester 3 · area: checkout, orders, account
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| ORD-005 | pass | A GET /api/orders/102 -> 404 {"error":"Not found"} | evidence/002/t3-ORD-005-007.txt | |
| ORD-007 | pass | A->102 404, B->101 404, A->101 200 with order #101 | evidence/002/t3-ORD-005-007.txt | |
| ORD-003 | pass | /orders 302 /login?next=/orders; /orders/101 302 /login; /api/orders/101 401 | evidence/002/t3-ORD-003.txt | |
| ORD-004 | pass | A /orders/102 -> 404 "Order not found", no Blair/Oak Lane | evidence/002/t3-ORD-003-004.txt | |
| CHK-002 | pass | Cart Total $42.00, checkout Total $42.00 | evidence/002/t3-money1.txt | |
| CHK-005 | pass | B checkout input shipTo value="12 Oak Lane" | evidence/002/t3-CHK-005-008.txt | |
| CHK-006 | pass | After order #105 ($42.00), Orders lists "Order #105 · $42.00"; cart Cart (0). (Order #101 is A's; not in this fresh user's list, by design) | evidence/002/t3-CHK-006.txt | |
| CHK-008 | pass | shipTo empty and "   " -> 200 "Please enter a Ship to address", no order | evidence/002/t3-CHK-005-008.txt | |
| ACCT-002 | pass | "Address saved"; reload value="4 Elm Road, Springfield" | evidence/002/t3-ACCT-002.txt | |
| ACCT-004 | pass | A saved 9 Pine Close, checkout prefilled | evidence/002/t3-ACCT-etc.txt | |
| ACCT-005 | pass | New user: box 9 Pine Close after reload, checkout prefilled | evidence/002/t3-ACCT-etc.txt | |
| CHK-003 | pass | "Your cart is empty. Continue shopping", no shipTo form | evidence/002/t3-ACCT-etc.txt | |
| CHK-004 | pass | Empty shipTo not placed, message shown; input has `required` | evidence/002/t3-CHK-005-008.txt | |
| ORD-002 | pass | "Order #101 Ship to: Alex, 4 Elm Road Total: $24.00" | evidence/002/t3-ACCT-etc.txt | |
| ACCT-001 | pass | "Hi Blair", address value 12 Oak Lane | evidence/002/t3-ACCT-box.txt | |
| ACCT-003 | pass | 302 /login?next=/account | evidence/002/t3-ACCT-etc.txt | |
| ORD-006 | pass | "No orders yet." | evidence/002/t3-ACCT-etc.txt | |
| CHK-007 | pass | money tour, no wrong amounts found; see charter notes | evidence/002/t3-money1.txt, t3-money2.txt | |
## Candidates
None.
## Charter notes
Money tour via curl (no browser; phone env not run). Covered: totals for mug x2+spoon (42), mug x3+spoon x5 (126), spoon qty 0 removes line, negative/non-numeric/fractional qty ignored (total unchanged), out-of-stock Linen towel add rejected, unknown product id add 302 and no change, qty 99999 accepted (total $1199988.00 consistent across cart/checkout; no cap, not judged a bug), cart -> checkout -> confirmation -> /orders -> /orders/<id> -> /api/orders/<id> totals all agreed (#105 $42, #106 $72). Concurrent double-submit placed one order only. HTML in Ship to is escaped on the order page. Not covered: browser back/two tabs, phone viewport.
## Learned
- Account address box is an `<input name="address">`, not a textarea; checkout is `<input name="shipTo" required>`.
- Git Bash: use quoted full URLs and `$B$p` with MSYS path conversion off for redirect checks; `-w` with leading "/" gets mangled.
- Throwaway users made: r2t3-one, r2t3-two, r2t3-three @example.test. Orders #105, #106 by r2t3-one. User A's saved address is now "4 Elm Road, Springfield" (was changed during tests); carts left empty.
