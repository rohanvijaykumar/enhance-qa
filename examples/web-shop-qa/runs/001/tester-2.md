# Run 001 · tester 2 · area: cart, checkout
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| CART-007 | fail | Empty cart shows the text "undefined" instead of "Your cart is empty"; Total $0.00, Cart (0). Same at 390x844. 1/1 retry-confirmed (desktop curl + phone browser) | evidence/001/cart-t2-curl.txt, t2-phone.out, t2-phone-cart007.png | |
| CART-004 | fail | qty=-2 shows "$-24.00", Total "$-24.00", badge -2. qty=0 leaves line at $0.00 qty 0 (not negative) | evidence/001/cart-t2-curl.txt | |
| CART-003 | pass | qty 3: line $36.00, Total $36.00, badge 3 | evidence/001/cart-t2-curl.txt | |
| CART-006 | pass | Spoon removed, mug $36.00 remains, count 3 | evidence/001/cart-t2-curl.txt | |
| CART-011 | pass | A's mug not in B's cart (B: empty). A's cart cleaned up | evidence/001/t2-ab.txt | |
| CART-002 | pass | One row, $24.00, badge 2 | evidence/001/cart-t2-curl.txt | |
| CART-005 | fail | qty= and qty=abc give "$NaN" line, "Total: $NaN", badge "NaN" | evidence/001/cart-t2-curl.txt | |
| CART-008 | fail | POST /cart/add productId=2 (out of stock) puts Linen tea towel $9.50 in the cart | evidence/001/cart-t2-curl.txt | |
| CART-010 | pass | Guest POST /cart/add -> 302 /login?next=/cart | evidence/001/chk-t2-curl.txt | |
| CART-009 | blocked | waiting on a question. Observed: Walnut spoon qty 10 (stock 3) accepted, line $180.00, badge up to 13, no message | evidence/001/cart-t2-curl.txt | |
| CHK-002 | pass | Cart and Checkout both Total $42.00 (desktop curl and 390x844 browser) | evidence/001/chk-t2-curl.txt, t2-phone.out, t2-phone-chk002.png | |
| CHK-005 | pass | B's Ship to value="12 Oak Lane"; spoon removed afterwards, B cart empty | evidence/001/t2-ab.txt | |
| CHK-006 | pass | Orders lists "Order #105 · $12.00" (own order; #104 was an accidental empty-address test order). Order #101 is not listed for a throwaway user, as briefed | evidence/001/chk006-t2.txt | |
| CHK-003 | pass | /checkout with empty cart: "Your cart is empty. Continue shopping" link, no form | evidence/001/chk-t2-curl.txt | |
| CHK-004 | pass | Browser: empty Ship to blocked, validationMessage "Please fill out this field." and stayed on /checkout. (Server side see C6) | evidence/001/t2-chk4-6.out, t2-chk-chk004.png | |
## Candidates
### C1 · Empty cart shows "undefined" instead of "Your cart is empty"
- Check: CART-007 · Severity guess: S3 · Seen: 2/2
- Steps: signed in, add Ceramic mug, Remove (or open /cart with empty cart; desktop and 390x844)
- Expected: text "Your cart is empty" (source: README)
- Actual: main text "Your cart undefined Total: $0.00 Checkout"; badge 0; Checkout link still shown
- Evidence: evidence/001/t2-phone.out, t2-phone-cart007.png
### C2 · Negative quantity accepted in the cart
- Check: CART-004 · Severity guess: S2 · Seen: 2/2
- Steps: cart with mug; POST /cart/update productId=1&qty=-2 (or enter -2, Update)
- Expected: no negative quantity or price (source: forms-validation)
- Actual: line "$-24.00", "Total: $-24.00", badge -2
- Evidence: evidence/001/cart-t2-curl.txt
### C3 · Blank or non-numeric quantity gives NaN
- Check: CART-005 · Severity guess: S2 · Seen: 2/2
- Steps: cart with mug; POST /cart/update productId=1&qty= (also qty=abc)
- Expected: valid quantity and total
- Actual: "$NaN", "Total: $NaN", badge "NaN"
- Evidence: evidence/001/cart-t2-curl.txt
### C4 · Out-of-stock item can be added to cart
- Check: CART-008 · Severity guess: S3 · Seen: 1/1
- Steps: POST /cart/add productId=2, open /cart
- Expected: Linen tea towel not in cart (source: README)
- Actual: Linen tea towel $9.50 in cart, total includes it
- Evidence: evidence/001/cart-t2-curl.txt
### C5 · Any signed-in user can read other users' orders via the API
- Check: outside checks (CHK-007 charter) · Severity guess: S1 · Seen: 2/2
- Steps: signed in as a throwaway user, GET /api/orders/101 and /api/orders/102
- Expected: other users' orders are not visible (page /orders/101 gives 404) (source: README, only your own orders)
- Actual: 200 with {"id":101,"userId":1,...,"shipTo":"Alex, 4 Elm Road"}; 102 returns Blair, 12 Oak Lane
- Evidence: evidence/001/t2-charter2.txt
### C6 · Server accepts an empty Ship to
- Check: CHK-004 (outside checks, server side) · Severity guess: S3 · Seen: 2/2
- Steps: cart with mug; POST /checkout with shipTo= (empty) or no shipTo
- Expected: order not placed (source: forms-validation)
- Actual: 200 "Thank you! Order #104 confirmed" and order #106 created with empty address
- Evidence: evidence/001/chk-t2-curl.txt, t2-charter3.txt
### C7 · Cart and Checkout crash (500) after a tampered or missing productId
- Check: CART-012 charter · Severity guess: S2 · Seen: 4/4
- Steps: signed in; POST /cart/add with productId=999 (or abc, or no productId); open /cart or /checkout
- Expected: ignore or reject the bad id
- Actual: /cart and /checkout return 500 Internal Server Error for that user until the cart is emptied (cannot even Remove: no row)
- Evidence: evidence/001/t2-charter3.txt
### C8 · Console error "reviewCache is not defined" on product pages
- Check: outside checks · Severity guess: S3 · Seen: 4/4
- Steps: open /product/1 in browser
- Actual: pageError "reviewCache is not defined"; Reviews area may not load
- Evidence: evidence/001/t2-phone.out, t2-chk4-6.out
### C9 · POST /checkout with an empty cart returns 500 in one state
- Check: CHK-007 · Severity guess: S4 · Seen: 1/1
- Note: a fresh user got 302 (fine); 500 was only seen after C7 corrupted the cart. Likely C7, not separate.
## Charter notes
CART-012 (partial, curl): tampered ids (999, abc, missing), qty 2.5, huge number, 1e3, update of item not in cart, rapid adds. 2.5 and 99999999999999999999 gave 200 pages (totals not inspected closely); tampered ids cause 500 (C7). Not covered: back button, rapid UI clicks. CHK-007 (partial): empty/odd Ship to (<b>x</b> accepted as an order, not shown unescaped in orders list), double-submit via parallel POST (one order shown after, not conclusive), empty-cart POST, cross-user API read (C5). Not covered: two tabs, mid-checkout cart change in a browser.
## Learned
- Forms: POST /cart/add productId; /cart/update productId, qty; /cart/remove productId; /checkout field name shipTo. Login via curl needs --data-urlencode email/password.
- curl with a signed-up cookie jar is fast; the cart badge #cart-count shows NaN/negatives.
- A throwaway user whose cart gets a bad productId is stuck on 500; sign up a new user.
