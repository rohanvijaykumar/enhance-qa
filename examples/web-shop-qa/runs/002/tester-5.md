# Run 002 · tester 5 · area: cart, checkout, account, auth, orders (spot audit)

## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| CART-003 | fail 2/2 | Qty input shows 3 and Total $36.00 and "Cart (3)" match, but the Ceramic mug row shows "$12.00" (unit price), not a line of $36.00. | qa/evidence/002/t5-CART-003.json, qa/evidence/002/t5-CART-003d.json, qa/evidence/002/t5-CART-003d-end.png | |
| CART-002 | fail 2/2 | One row, qty input 2, "Cart (2)" and Total $24.00 match. The row shows "$12.00", so "$24.00" appears only as the total, not on the row. | qa/evidence/002/t5-CART-002b.json, qa/evidence/002/t5-CART-002d.json, qa/evidence/002/t5-CART-002d-end.png | |
| CHK-002 | pass | Cart: Ceramic mug (qty 2) row $12.00, Walnut spoon row $18.00, "Total: $42.00". Checkout page: "Total: $42.00". Checkout shows no line items, so only the total was compared. | qa/evidence/002/t5-CHK-002a.json, qa/evidence/002/t5-CHK-002a-end.png | |
| ACCT-004 | pass | Ship to input value is "9 Pine Close" (read from the input's value). My first run failed on a plan assertion that looked in body text, which doesn't include input values. The field value itself is the evidence. Single run after the plan fix. | qa/evidence/002/t5-ACCT-004.json, qa/evidence/002/t5-ACCT-004-fail.png | |
| AUTH-002 | pass | Page text "Incorrect email or password"; URL stays /login; "Sign out" absent. | qa/evidence/002/t5-AUTH-002.json, qa/evidence/002/t5-AUTH-002-end.png | |
| ORD-005 | pass | GET /api/orders/102 as user A: status 404, body `{"error":"Not found"}`. No "Blair" or "12 Oak Lane" in the body. | qa/evidence/002/t5-ORD-005.json | |

Counts: passed 4 · failed 2 · blocked 0 · not run 0.

## Candidates
### C1 · Cart row shows the unit price, not the line amount
- Check: CART-003 (also CART-002) · Severity guess: S3 · Seen: 2/2 (CART-003) and 2/2 (CART-002)
- Steps: Sign up a new user with an empty cart → Shop → Ceramic mug → Add to cart → Cart → set quantity to 3 → Update.
- Expected: line $36.00, Total $36.00, "Cart (3)" (source: qa/checklist/cart.md CART-003, README "change quantities").
- Actual: quantity input = 3, Total $36.00, header "Cart (3)", but the Ceramic mug row's price cell reads "$12.00" (`rows`: "Item Qty Price || Ceramic mug / Update / $12.00 / Remove"). For CART-002 with qty 2, the row reads "$12.00" and the Total reads "$24.00".
- Evidence: qa/evidence/002/t5-CART-003d.json, qa/evidence/002/t5-CART-002d.json, qa/evidence/002/t5-CART-003d-end.png

## Charter notes
None (checks only).

## Learned
- Fresh browser context per plan, so signup inside each plan is needed for a clean cart; signup password passed via env var from the shell.
- Add to cart on a product page redirects to /cart, so a second add needs `goto /` then the product link again.
- Qty inputs have aria-label "Quantity for <product>" (use `label`); `innerText` does not include input values, so read them with eval.
- Shell escaping: `\n` inside eval strings breaks; use `String.fromCharCode(10)`.
- Ship to is an input named `shipTo`; its value is not in body text.
- Cart remove: button "Remove" on /cart; empty cart text "Your cart is empty. Continue shopping".
- Throwaway users created in this run (r2t5-cart2*, r2t5-cart3*, r2t5-chk2*, several timestamps) still have items in their carts; their passwords were not kept, so I could not sign back in to empty them. User A's cart was emptied (Cart (0)).
- User A's saved address is now "9 Pine Close" (set by ACCT-004 as the check requires).
