# Orders
- Area: ORD
- Paths: server.js
- Modules: web-app, security
- Notes: Seed: user A owns #101, user B owns #102.

### ORD-001 · Orders lists your own past orders
- Risk: high · Type: agent · Tags: smoke
- Steps: Sign in as test user A → "Orders"
- Expect: "Order #101 · $24.00" is listed; #102 is not
- Source: README (Features: a list of your past orders)

### ORD-002 · An order's page shows its details
- Risk: medium · Type: agent
- Steps: Signed in as test user A → Orders → "Order #101"
- Expect: "Order #101", "Ship to: Alex, 4 Elm Road", "Total: $24.00"
- Source: README (Features: past orders)

### ORD-003 · Orders needs sign-in
- Risk: high · Type: agent · Tags: security, prod-safe
- Steps: As a guest open /orders, /orders/101 and /api/orders/101
- Expect: The pages redirect to sign in; the API answers 401; no order data is shown
- Source: README (Features: you can only ever see your own orders)

### ORD-004 · You can't open another user's order page
- Risk: high · Type: agent · Tags: security
- Steps: Sign in as test user A → open /orders/102 (user B's)
- Expect: "Order not found" (404); none of user B's details
- Source: README (Features: you can only ever see your own orders)

### ORD-005 · You can't read another user's order through the API
- Risk: high · Type: agent · Tags: security
- Steps: Sign in as test user A → GET /api/orders/102
- Expect: 404 (or 403); none of user B's details (no "Blair", no "12 Oak Lane")
- Source: README (Features: you can only ever see your own orders)

### ORD-006 · A user with no orders sees an empty state
- Risk: low · Type: agent
- Steps: Sign up a new user → "Orders"
- Expect: "No orders yet."
- Source: base: empty state

### ORD-007 · Customers can't read another customer's order through the API
- Risk: high · Type: agent · Tags: regression
- Steps: Sign in as test user A → GET /api/orders/102; as test user B → GET /api/orders/101; as A → GET /api/orders/101
- Expect: 102 and 101-for-B return 404 with no other user's details; A still gets order #101
- Source: BUG-001
