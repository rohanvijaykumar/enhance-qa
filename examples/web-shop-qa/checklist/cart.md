# Cart
- Area: CART
- Paths: server.js
- Modules: web-app, payments-subscriptions, forms-validation
- Notes: Signed-in users only; guests are sent to sign in.

### CART-001 · Adding an item puts it in the cart and updates the count
- Risk: high · Type: agent · Tags: smoke
- Steps: Sign in as test user A → open Ceramic mug → "Add to cart"
- Expect: The cart page lists Ceramic mug, qty 1, $12.00; header shows "Cart (1)"; Total $12.00
- Source: README (Features: cart you can add to)

### CART-002 · Adding the same item twice increases its quantity
- Risk: medium · Type: agent
- Steps: Signed in, with an empty cart → add Ceramic mug twice
- Expect: One row, qty 2, $24.00; "Cart (2)"
- Source: payments-subscriptions: cart arithmetic

### CART-003 · Changing a quantity updates the line and total
- Risk: high · Type: agent
- Steps: Cart with Ceramic mug qty 1 → set its quantity to 3 → "Update"
- Expect: Qty 3, line $36.00, Total $36.00, "Cart (3)"
- Source: README (Features: change quantities)

### CART-004 · A quantity of 0 or less is not accepted as a negative line
- Risk: high · Type: agent
- Steps: Cart with Ceramic mug → set quantity to -2 → "Update"; then try 0
- Expect: No negative quantity or negative price is ever shown; the cart either rejects the value or removes the item
- Source: forms-validation: numeric bounds; payments-subscriptions: totals never negative

### CART-005 · A blank or non-numeric quantity doesn't break the cart
- Risk: medium · Type: agent
- Steps: Cart with Ceramic mug → clear the quantity box (empty) → "Update" (use curl with qty= or qty=abc if the browser blocks it)
- Expect: The cart still shows a valid quantity and a valid total (no "NaN", no error page)
- Source: forms-validation

### CART-006 · Removing an item takes it out of the cart
- Risk: high · Type: agent
- Steps: Cart with Ceramic mug and Walnut spoon → "Remove" on Walnut spoon
- Expect: Only Ceramic mug remains; total and count update
- Source: README (Features: remove items)

### CART-007 · Removing the last item shows "Your cart is empty"
- Risk: high · Type: agent
- Steps: Cart with one item → "Remove"
- Expect: The text "Your cart is empty" is shown; Total $0.00; "Cart (0)"; no "undefined" or placeholder text
- Source: README (Features: removing the last item shows "Your cart is empty")

### CART-008 · An out-of-stock item can't be added
- Risk: medium · Type: agent
- Steps: Signed in → POST /cart/add with productId=2 (Linen tea towel, out of stock) via curl → open /cart
- Expect: The Linen tea towel is not in the cart
- Source: README (Features: out-of-stock items are marked); payments-subscriptions: stock

### CART-009 · You can't add more than the stock
- Risk: low · Type: agent
- Steps: Signed in → add Walnut spoon (stock 3) → set quantity 10 → "Update"
- Expect: The quantity is capped or refused with a message
- Source: payments-subscriptions: stock limits
- Question: What should happen when a quantity is above stock: cap at stock, refuse with a message, or allow back-orders?

### CART-010 · A guest who clicks Add to cart is asked to sign in
- Risk: medium · Type: agent
- Steps: As a guest open Ceramic mug → "Add to cart"
- Expect: Taken to the sign-in page
- Source: README (Features: cart); base: guest path

### CART-011 · Each user has their own cart
- Risk: high · Type: agent · Tags: security
- Steps: As test user A add Ceramic mug → in a separate session sign in as test user B → open /cart
- Expect: User B's cart does not contain user A's item
- Source: README (Features: you can only ever see your own orders); security: isolation

### CART-012 · Charter: the money tour through the cart
- Risk: high · Type: agent · Tags: exploratory
- Steps: 20 minutes. Add, update, remove, big numbers, decimals, rapid clicks, tampered productIds, back button. Watch every total.
- Expect: No S1–S3 problems; notes say what was covered
- Source: base: money tour

### CART-013 · Bad quantities never produce negative or NaN totals
- Risk: high · Type: agent · Tags: regression
- Steps: Cart with Ceramic mug → POST /cart/update qty=-2, then qty= (empty), then qty=abc
- Expect: Quantity stays valid (no negative, no "NaN" in the line, total or header count)
- Source: BUG-010

### CART-014 · The empty cart says "Your cart is empty"
- Risk: high · Type: agent · Tags: regression
- Steps: Cart with one item → Remove
- Expect: "Your cart is empty" with a Continue shopping link; Total $0.00; Cart (0); no "undefined"
- Source: BUG-011

### CART-015 · Out-of-stock items can't be added by a direct request
- Risk: high · Type: agent · Tags: regression
- Steps: Signed in → POST /cart/add productId=2 → /cart
- Expect: Linen tea towel not in the cart
- Source: BUG-012

### CART-016 · Unknown product IDs don't break the cart
- Risk: high · Type: agent · Tags: regression
- Steps: Signed in → POST /cart/add productId=999, then productId=abc → GET /cart and /checkout
- Expect: Both pages load (200); nothing added
- Source: BUG-013
