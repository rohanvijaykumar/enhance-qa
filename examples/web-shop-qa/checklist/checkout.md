# Checkout
- Area: CHK
- Paths: server.js
- Modules: payments-subscriptions, forms-validation
- Notes: Test mode only; no real payments.

### CHK-001 · Placing an order in test mode confirms it
- Risk: high · Type: agent · Tags: smoke
- Steps: Sign in as test user A → add Ceramic mug → Cart → "Checkout" → Ship to "Alex, 4 Elm Road" → "Place order (test mode)"
- Expect: "Thank you!" with "Order #<n> is confirmed. Total $12.00." and a link to your orders; the cart is empty afterwards ("Cart (0)")
- Source: README (Features: checkout in test mode)

### CHK-002 · Checkout total matches the cart total
- Risk: high · Type: agent
- Steps: Cart with Ceramic mug qty 2 and Walnut spoon qty 1 → open Checkout
- Expect: Checkout shows Total $42.00, the same as the cart
- Source: payments-subscriptions: totals consistent

### CHK-003 · Checkout with an empty cart doesn't place an order
- Risk: medium · Type: agent
- Steps: Signed in with an empty cart → open /checkout
- Expect: "Your cart is empty" with a "Continue shopping" link; no order form
- Source: base: empty state

### CHK-004 · Ship to is required
- Risk: medium · Type: agent
- Steps: Cart with an item → Checkout → leave Ship to empty → "Place order (test mode)"
- Expect: The order isn't placed; the field is flagged as required
- Source: forms-validation

### CHK-005 · The saved address is used at checkout
- Risk: high · Type: agent
- Steps: Sign in as test user B (saved address "12 Oak Lane") → add Walnut spoon → Checkout
- Expect: Ship to is prefilled with "12 Oak Lane"
- Source: README (Features: save a shipping address; it's used at checkout)

### CHK-006 · The new order appears in Orders with the right total
- Risk: high · Type: agent
- Steps: After CHK-001 → click "Your orders"
- Expect: The new order is listed with Total $12.00, as well as order #101
- Source: README (Features: list of your past orders)

### CHK-007 · Charter: checkout interruptions
- Risk: high · Type: agent · Tags: exploratory
- Steps: 15 minutes. Double-submit, back after placing, two tabs, changing the cart in another tab mid-checkout, odd Ship to text.
- Expect: No S1–S3 problems; notes say what was covered
- Source: base: exploratory

### CHK-008 · No order without a Ship to
- Risk: high · Type: agent · Tags: regression
- Steps: Cart with Ceramic mug → POST /checkout with shipTo= (empty) and shipTo="   "
- Expect: No order placed; checkout asks for a Ship to address
- Source: BUG-019
