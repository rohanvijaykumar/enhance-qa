# Security
- Area: SEC
- Paths: *
- Modules: security, admin-backoffice

### SEC-001 · Customers can't open admin pages
- Risk: high · Type: agent · Tags: security
- Steps: Sign in as test user A (a customer) → open /admin
- Expect: Access is refused (403, 404 or redirect); no list of other users' emails is shown
- Source: security: access control; README (you can only ever see your own orders)

### SEC-002 · No page shows another customer's personal data
- Risk: high · Type: agent · Tags: security
- Steps: Signed in as test user A, visit every page in the app map and the JSON endpoints
- Expect: No page or API shows user B's name, email, address or orders
- Source: README (Features: you can only ever see your own orders)

### SEC-003 · Search text is shown as text, not run as code
- Risk: high · Type: agent · Tags: security
- Steps: Open /?q=<b>bold</b><img src=x onerror=alert(1)>
- Expect: The query is displayed literally (escaped); no bold text, no image, no script runs
- Source: security: reflected XSS

### SEC-004 · The sign-in "next" parameter can't inject code or send you off-site
- Risk: high · Type: agent · Tags: security
- Steps: Open /login?next="><script>alert(1)</script> and check the page source → then open /login?next=https://example.com and sign in as test user A
- Expect: No script is injected; after signing in you stay on Corner Shop (not sent to example.com)
- Source: security: XSS, open redirect

### SEC-005 · No secret keys are sent to the browser
- Risk: high · Type: auto · Tags: security, prod-safe
- Command: `curl -s http://localhost:4310/static/app.js http://localhost:4310/static/style.css | grep -nE "sk_(test|live)_|secret|SECRET"` → any match fails
- Expect: No secret key or secret-looking value in any file served to the browser
- Source: security: secrets in client bundle

### SEC-006 · Static files can't reach outside the static folder
- Risk: medium · Type: agent · Tags: security
- Steps: `curl --path-as-is http://localhost:4310/static/../server.js` and `/static/..%2fserver.js`
- Expect: 404; server source is never returned
- Source: security: path traversal

### SEC-007 · Session cookie is HttpOnly
- Risk: medium · Type: auto · Tags: security
- Command: `curl -si -d "email=$QA_USER_A_EMAIL&password=$QA_USER_A_PASSWORD" http://localhost:4310/login | grep -i set-cookie` → must contain HttpOnly and SameSite
- Expect: Set-Cookie includes HttpOnly and SameSite
- Source: security: cookies

### SEC-008 · Error pages don't leak internals
- Risk: medium · Type: agent · Tags: security
- Steps: Send malformed requests (bad JSON body to /login with Content-Type application/json, very long URL)
- Expect: No stack traces or file paths shown to the user
- Source: security: error disclosure

### SEC-009 · Charter: attacker's tour
- Risk: high · Type: agent · Tags: exploratory, security
- Steps: 20 minutes. As test user A, try to reach user B's data or change it: tampered IDs in forms and URLs, cart/remove and cart/update with other productIds, account fields with HTML.
- Expect: No S1–S3 problems; notes say what was covered
- Source: base: exploratory

### SEC-010 · Names and Ship to addresses are shown as text
- Risk: high · Type: agent · Tags: regression
- Steps: Sign up with Name `<b>x</b><img src=x>` → /account → check out with Ship to `<i>ship</i><img src=y>` → open the order page
- Expect: All text shown literally; no HTML elements created
- Source: BUG-021

### SEC-011 · Only admins can open the admin page
- Risk: high · Type: agent · Tags: regression
- Steps: Signed in as test user A (a customer) → open /admin, /admin/ and /ADMIN; then sign out and open /admin
- Expect: Customers get 403, 404 or a redirect with no list of users or emails; signed out redirects to sign in
- Source: BUG-002
