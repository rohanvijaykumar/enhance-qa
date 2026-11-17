# Account
- Area: ACCT
- Paths: server.js
- Modules: settings-persistence, forms-validation

### ACCT-001 · The account page greets you and shows your address
- Risk: medium · Type: agent
- Steps: Sign in as test user B → "Account"
- Expect: "Hi Blair"; Shipping address box contains "12 Oak Lane"
- Source: README (Features: save a shipping address in your account)

### ACCT-002 · Saving an address keeps it
- Risk: high · Type: agent
- Steps: Sign in as test user A → Account → Shipping address "4 Elm Road, Springfield" → "Save address" → reload /account
- Expect: "Address saved" is shown, and after reload the box still contains "4 Elm Road, Springfield"
- Source: README (Features: save a shipping address in your account)

### ACCT-003 · Account needs sign-in
- Risk: medium · Type: agent · Tags: security, prod-safe
- Steps: As a guest open /account
- Expect: Redirected to sign in
- Source: base: protected pages

### ACCT-004 · A newly saved address is used at checkout
- Risk: high · Type: agent
- Steps: Sign in as test user A → save address "9 Pine Close" → add Ceramic mug → Checkout
- Expect: Ship to is prefilled with "9 Pine Close"
- Source: README (Features: it's used at checkout)

### ACCT-005 · A saved address is kept and used at checkout
- Risk: high · Type: agent · Tags: regression
- Steps: New user → Account → Shipping address "9 Pine Close" → Save address → reload → add Ceramic mug → Checkout
- Expect: The box shows "9 Pine Close" after reload; Ship to is prefilled with it
- Source: BUG-009
