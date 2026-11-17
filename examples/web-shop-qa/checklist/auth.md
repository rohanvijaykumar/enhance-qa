# Auth
- Area: AUTH
- Paths: server.js
- Modules: accounts-auth, forms-validation
- Notes: Email and password; sessions are a cookie. Two seeded test users.

### AUTH-001 · A test user can sign in
- Risk: high · Type: agent · Tags: smoke
- Steps: Open /login → enter test user A's email and password → click "Sign in"
- Expect: Lands on / signed in: the header shows Cart, Account, Orders and "Sign out"
- Source: README (Features: sign in; Run it: test accounts)

### AUTH-002 · A wrong password shows a clear error
- Risk: high · Type: agent
- Steps: Open /login → enter test user A's email and the password "wrong-password" → click "Sign in"
- Expect: "Incorrect email or password" is shown; no error page; not signed in
- Source: accounts-auth: wrong credentials

### AUTH-003 · An unknown email shows the same error
- Risk: medium · Type: agent
- Steps: Open /login → enter "nobody@example.test" and any password → click "Sign in"
- Expect: "Incorrect email or password" (the same message as a wrong password, so it doesn't reveal which emails exist)
- Source: accounts-auth: account enumeration

### AUTH-004 · Email is matched without regard to case or spaces
- Risk: low · Type: agent
- Steps: Sign in with test user A's email in capitals with a trailing space, and the right password
- Expect: Signed in
- Source: accounts-auth: email normalisation
- Assumed: yes

### AUTH-005 · Sign up creates an account and signs you in
- Risk: high · Type: agent · Tags: smoke
- Steps: Open /signup → Name "QA New", Email "qa-new-<random>@example.test", Password "longenough1" → click "Create account"
- Expect: Lands on /account showing "Hi QA New"; the header shows "Sign out"
- Source: README (Features: sign up)

### AUTH-006 · Sign up rejects a short password
- Risk: medium · Type: agent
- Steps: Open /signup → valid name and new email, password "short" → "Create account"
- Expect: "Password must be at least 8 characters"; no account created
- Source: forms-validation

### AUTH-007 · Sign up rejects an email that already has an account
- Risk: high · Type: agent
- Steps: Open /signup → Name "Dup", Email test user A's email, Password "longenough1" → "Create account" → then sign out and sign in as test user A with test-pass-a
- Expect: Sign-up is refused with a message that the email is already registered; test user A can still sign in with their own password and sees their own order #101
- Source: accounts-auth: duplicate accounts

### AUTH-008 · Sign up rejects an invalid email
- Risk: medium · Type: agent
- Steps: Open /signup → Name "Bad", Email "not-an-email", Password "longenough1" → "Create account"
- Expect: The form refuses the email (browser or server message); no account created
- Source: forms-validation

### AUTH-009 · Sign out ends the session
- Risk: high · Type: agent
- Steps: Sign in as test user A → click "Sign out" → open /orders
- Expect: Redirected to /login; the header shows "Sign in"
- Source: accounts-auth: sign out

### AUTH-010 · A signed-out session cookie can't be reused
- Risk: medium · Type: agent · Tags: security
- Steps: Sign in as test user A with curl and keep the sid cookie value → POST /logout with it → request /orders again sending the old sid cookie
- Expect: The old cookie no longer works: /orders redirects to /login
- Source: accounts-auth: session invalidation

### AUTH-011 · Forgot password accepts an email and confirms neutrally
- Risk: medium · Type: agent
- Steps: Open /login → "Forgot password?" → enter test user A's email → "Send reset link"
- Expect: "Check your email" with a neutral message that doesn't reveal whether the account exists; same page for "nobody@example.test"
- Source: README (Features: reset your password); accounts-auth: enumeration

### AUTH-012 · Signing in returns you to where you were going
- Risk: medium · Type: agent
- Steps: As a guest open /orders → redirected to the sign-in page → sign in as test user A
- Expect: Lands on /orders after signing in
- Source: accounts-auth: return-to after login

### AUTH-013 · Charter: sign-in and sign-up edge cases
- Risk: high · Type: agent · Tags: exploratory
- Steps: 20 minutes. Empty fields, very long values, unicode, pasting spaces, double submit, back button after sign out, tampering with hidden fields.
- Expect: No S1–S3 problems; notes say what was covered
- Source: base: exploratory

### AUTH-014 · The sign-in "next" value is escaped and stays on site
- Risk: high · Type: agent · Tags: regression
- Steps: Open /login?next="><script>alert(1)</script> and read the HTML → POST /login as test user A with next=https://example.com, then with next=//evil.test, then next=/orders
- Expect: No script tag injected; the first two land on / on Corner Shop; next=/orders lands on /orders
- Source: BUG-004

### AUTH-015 · A wrong password shows the friendly error
- Risk: high · Type: agent · Tags: regression
- Steps: Open /login → test user A's email + "wrong-password" → Sign in (desktop and 390×844)
- Expect: "Incorrect email or password"; no 500; not signed in
- Source: BUG-006

### AUTH-016 · A registered email can't sign up again
- Risk: high · Type: agent · Tags: regression
- Steps: Open /signup → Name "Dup", Email = test user A's email (also in capitals with a trailing space), Password "longenough1"
- Expect: "An account with this email already exists"; no account created; test user A still signs in and sees order #101
- Source: BUG-007

### AUTH-017 · A signed-out session cookie stops working
- Risk: high · Type: agent · Tags: regression
- Steps: Sign in with curl, keep sid → POST /logout → GET /orders with the old sid
- Expect: 302 to /login
- Source: BUG-008

### AUTH-018 · Sign up refuses invalid emails
- Risk: high · Type: agent · Tags: regression
- Steps: Open /signup → Email "not-an-email" (then "a@b"), valid name and password
- Expect: Refused with "Enter a valid email address"; no account created
- Source: BUG-020
