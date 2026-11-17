# Run 002 · tester 2 · area: cart
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| CART-003 | pass | qty 3 -> Cart (3), Total $36.00 | evidence/002/t2-cart-a.txt | |
| CART-004 | pass | qty -2 ignored (stays 3); qty 0 removes item, Total $0.00 | evidence/002/t2-cart-a.txt | |
| CART-006 | pass | Remove spoon: only mug, $12.00, Cart (1) | evidence/002/t2-cart-a.txt | |
| CART-007 | pass | "Your cart is empty.", Total: $0.00, Cart (0) | evidence/002/t2-cart-a.txt | |
| CART-011 | pass | A has mug, B cart empty; A cart cleared after | evidence/002/t2-cart-b.txt | |
| CART-013 | pass | -2, empty, abc all leave qty 1, $12.00 | evidence/002/t2-cart-a.txt | |
| CART-014 | pass | Continue shopping link present, no "undefined" | evidence/002/t2-cart-a.txt | |
| CART-015 | pass | productId=2 not added | evidence/002/t2-cart-a.txt | |
| CART-016 | pass | 999 and abc: /cart 200, /checkout 200, nothing added | evidence/002/t2-cart-a.txt | |
| CART-002 | pass | One row, qty 2, $24.00, Cart (2) | evidence/002/t2-cart-b.txt | |
| CART-005 | fail | blank/abc/1.5 fine (qty kept), but qty=99999999999999999999 gives Total $1.2e+21 and Cart (100000000000000000000) | evidence/002/t2-cart-b.txt | |
| CART-008 | pass | Linen tea towel not in cart | evidence/002/t2-cart-a.txt | |
| CART-010 | pass | Guest add -> 302 /login?next=/cart | evidence/002/t2-cart-c.txt | |
| CART-009 | blocked: waiting on a question | Observed: Walnut spoon (stock 3) qty 10 accepted: Cart (10), Total $180.00 | evidence/002/t2-cart-c.txt | |
| CART-012 | fail | see candidates; no back-button/two-tab in a real browser (curl only) | evidence/002/t2-cart-c.txt, t2-cart-d.txt | |
## Candidates
### C1 · Huge quantity shows total like "$1.2e+21" and count 100000000000000000000
- Check: CART-005 (also CART-012) · Severity guess: S3 · Seen: 2/2
- Steps: signed in, Ceramic mug in cart; POST /cart/update productId=1 qty=99999999999999999999; GET /cart
- Expected: valid quantity and valid total (source: CART-005 Expect)
- Actual: Header "Cart ( 100000000000000000000 )", "Total: $1.2e+21". qty=9007199254740993 gives Total $108086391056891904.00 (precision lost; 9007199254740993*12 is not that). qty=1000000 accepted ($12000000.00).
- Evidence: evidence/002/t2-cart-b.txt, t2-cart-c.txt
### C2 · No upper bound on quantity (outside checks; relates to CART-009 question)
- Check: CART-012 · Severity guess: S3 · Seen: 1/1
- Steps: as C1 with qty=1000000, and Walnut spoon (stock 3) qty 10
- Expected: sensible limit (pending product answer)
- Actual: accepted; large orders can be placed in principle (not tried with huge qty at checkout)
- Evidence: evidence/002/t2-cart-c.txt
## Charter notes
Covered via curl with a throwaway user: huge/precision-losing quantities, 1e3, 0x10, "+3", "5abc", " 5", "-0", 1.5 (all rejected, qty kept), tampered productIds (duplicate param, __proto__, 1.0, -1, update on item not in cart: no breakage), 20 parallel adds (27 = 7+20, correct), double remove, remove missing item, update after removal, checkout then resubmit (no duplicate order; cart emptied; order #104 $24.00). Not covered: back button and two tabs in a real browser, phone viewport. Hand those to a fresh tester.
## Learned
- Cart qty input value is in the HTML as name="qty"; text strip hides it, use header count.
- Invalid qty is silently ignored (stays previous), 0 removes.
- Signup via curl works: POST /signup with name,email,password -> 302 with cookie.
