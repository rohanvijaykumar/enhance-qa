---
module: accounts-auth
kind: feature
title: Accounts and authentication
checked: 2026-11-16
---
# Accounts and authentication

Sign-up, verification, login, logout, password reset, sessions, social login, 2FA, roles and permissions, account deletion. Covers what a user sees and what the server enforces. Deeper attack testing is in `security.md`; consent and data-deletion law is in `privacy-consent.md`; admin screens are in `admin-backoffice.md`. Usually goes with `web-app.md` or a mobile module, and `notifications.md` for the emails.

## Signals

- Dependencies or services: `next-auth`, `@auth/core`, `passport`, `devise`, `django.contrib.auth`, `Auth0`, `Clerk`, `Supabase Auth`, `Firebase Auth`, `Cognito`, `Keycloak`, `Lucia`, `better-auth`, Spring Security.
- Routes or screens named login, signup, register, forgot-password, verify-email, account, profile, settings/security.
- Database tables `users`, `sessions`, `accounts`, `roles`, `password_resets`; JWT or session cookies in responses.
- README words: "sign in", "workspace", "teams", "SSO", "roles", "2FA".

## Kickoff questions

1. Which sign-in methods exist, and is there a dev or test mode for each? (best guess: email and password, plus Google through a test client or a dev bypass)
2. Which roles exist, and what may each do? (best guess: user and admin)
3. Where do emails go in the test environment? (best guess: a local catcher such as Mailpit, or the provider's test inbox)

## Drivers

1. **Playwright (or the product's own e2e runner) with two browser contexts.** Best default. One context per test account gives two isolated cookie jars. Save sign-in state with `storageState` so later checks start signed in. Observe with scoped accessibility snapshots and the network log, not screenshots.
2. **HTTP client (curl, httpie, Playwright `request`).** For the server-side checks that matter most: call an API with no cookie, with user A's cookie on user B's ids, with an expired or tampered token. Compare status codes and bodies.
3. **Email catcher (Mailpit, MailHog, the provider's sandbox inbox).** Read verification and reset emails through its web UI or API (Mailpit has a JSON API) instead of a real mailbox. Check the catcher, never a real address.
4. **Provider test modes.** Auth0, Clerk, Supabase, Firebase and Cognito all offer dev tenants, test users, or emulators (Firebase Auth Emulator). Use them. For OAuth, use the app's dev or test sign-in, a local mock identity provider, or a seeded session.
5. **Database or auth-admin read.** Confirm end state (user row created, email_verified flag, password hash present and not plain text, session row deleted on logout). Read-only on anything shared.
6. **TOTP code generator.** For 2FA, compute codes from the test account's secret with a library such as `otplib` or `oathtool`.

**Can't be driven here:** real identity providers (Google, Apple, GitHub login pages) are never automated by an agent: they block bots, need real credentials, and may lock the user's account. Passkeys and hardware security keys need a real authenticator (Chrome DevTools has a virtual authenticator for WebAuthn; use it for the flow, and mark real-device passkey sync human). SMS one-time codes to a real phone are human checks. CAPTCHAs are never bypassed by an agent.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | email + password sign-up, sign in, sign out, on the main browser |
| check | smoke, plus reset password, and the flows the change touched |
| full | pairwise over method, role, browser, device width, verified or not, 2FA on or off |
| release | every sign-in method and role, two-account isolation sweep, session expiry, human cells |

Dimensions: sign-in method (password, magic link, social, SSO, passkey), role (anonymous, user, admin, suspended), account state (unverified, verified, locked, deleted), browser, mobile web or native, 2FA on or off, remember me on or off.

## Check catalogue

### Sign-up and verification
- [high · agent] Sign up with a new test email and valid password → account created, confirmation or verification email arrives in the catcher, user lands somewhere sensible {smoke}
- [high · agent] Click the verification link → account becomes verified, the user is signed in or sent to login, and the link works only once
- [medium · agent] Reuse an old or expired verification link; use a link with a changed token → clear message, no verification, no crash
- [medium · agent] Sign up twice with the same email, and with different letter case (`A@x.com` vs `a@x.com`) → one account only, or a clear "already registered" path
- [medium · agent] Email edge cases: plus tags (`a+1@x.com`), leading or trailing spaces, unicode domains, very long addresses → accepted or rejected consistently on client and server
- [medium · agent] Password rules: too short, very long (200+ characters), spaces, unicode, only common words ("password1") → rules shown before submit and enforced by the server; long passphrases are allowed
- [medium · agent] Use the product before verifying the email → behavior matches the docs (blocked, limited, or allowed); never silently grants full access if verification is meant to be required
- [medium · agent] Resend verification repeatedly → rate limited or one at a time; no flood of emails to the catcher

### Login and logout
- [high · agent] Sign in with a correct email and password → lands on the expected page, and the header shows the right user {smoke}
- [high · agent] Wrong password, unknown email → one generic message such as "Invalid email or password"; no hint which part was wrong
- [high · agent] Sign out → session ends, Back button does not show private pages, protected API calls return 401 {smoke}
- [medium · agent] Sign out in one tab, then act in a second tab → second tab prompts for sign-in and loses no unsaved input silently
- [medium · agent] Deep link to a protected page while signed out → login first, then back to the original page (check the redirect target is not an open redirect to another site) {security}
- [medium · agent] Already signed in and open `/login` or `/signup` → redirected sensibly, no second session confusion
- [medium · agent] Remember me off vs on → off: session ends when the browser closes; on: session survives a browser restart (check the cookie lifetime in the network log)
- [low · agent] Tab, Enter and password-manager autofill on the login form → submits with Enter, field types are `email` and `password`, autofill fills both {a11y}

### Password reset and change
- [high · agent] Request a reset for an existing and a nonexistent email → identical on-screen message and similar response time, so accounts can't be enumerated {security}
- [high · agent] Use the reset link → new password works, old password stops working, link can't be used a second time {security}
- [medium · agent] Reset link after its expiry, or after a newer reset was requested → rejected with a clear message
- [medium · agent] After a reset or password change → other active sessions are signed out (or the product states otherwise), and a notification email is sent {security}
- [medium · agent] Change password while signed in with a wrong current password → refused; with the right one → works
- [medium · agent] Change email address → confirmation goes to the new address; the old address is told; nothing changes until confirmed

### Sessions and expiry
- [high · agent] Inspect session cookies in the network log → `HttpOnly`, `Secure` (on HTTPS) and a sensible `SameSite`; no token in the URL or in `localStorage` unless the docs say so {security}
- [medium · agent] Session expiry mid-task (shorten the TTL in test config, or delete the session row) → next action gives a sign-in prompt, and unsaved work is kept or the user is told
- [medium · agent] Expired or tampered JWT or session ID sent by HTTP client → 401, not 500, and no data
- [medium · agent] Sign in on two devices, then "sign out everywhere" or revoke one in the sessions list → the revoked session fails on its next request
- [medium · agent] Session ID before and after login → value changes after login (no session fixation) {security}

### Social login and SSO
- [high · agent] Use the app's dev or test sign-in for each provider → account is created or linked, name and avatar land, user reaches the app (never automate the real provider's page)
- [medium · agent] Sign in with a social account whose email already has a password account → linked after proof of ownership, or a clear "use your password" message; never a silent takeover {security}
- [medium · agent] Cancel or deny at the provider (simulated through the test provider's error response) → back at the app with a readable message, no half-created account
- [medium · agent] Unlink a provider when it is the only sign-in method → blocked with a message, so the user is not locked out

### Two-factor authentication
- [high · agent] Enroll a TOTP app with the test secret, then sign in → code required, wrong code refused, right code accepted
- [medium · agent] Reuse a code within the same time window; use a code from the previous window → reused code refused; one step of clock drift tolerated
- [medium · agent] Backup or recovery codes → each works once; regenerating invalidates the old set
- [medium · agent] Disable 2FA, or reset it → requires the current password or a code; sends a notification
- [medium · agent] Repeated wrong OTP codes → rate limited or locked out, not unlimited guessing {security}

### Roles, permissions and isolation
- [high · agent] Two test accounts (A and B): copy an object URL or ID from A and open it as B, in the UI and by API → 403 or 404, never B seeing A's data {security}
- [high · auto] As B, call API endpoints with A's record IDs for read, update and delete → each refused; the data is unchanged afterwards {security}
- [high · agent] As a plain user, call admin endpoints directly (not through the hidden menu) → 403 {security}
- [medium · agent] Change a role mid-session (promote, then demote) → new rights apply on the next request without needing a new login, or the docs say when
- [medium · agent] List endpoints and search as B → results only contain B's data; counts and totals don't leak A's
- [medium · agent] Mass-assignment: send extra fields such as `role: "admin"` or `user_id` in profile update requests → ignored by the server {security}

### Lockout and abuse resistance
- [medium · agent] Ten wrong passwords in a row on a test account (a small number, against the test environment only) → throttled, delayed or locked, with a clear message and a way to recover
- [medium · agent] After a lockout, wait or use the recovery path → access restored; lockout of one account does not lock others
- [low · agent] Response timing and wording for unknown vs known accounts on login, reset and sign-up → no visible difference {security}

### Account deletion and data
- [high · agent] Delete the account with a confirmation step (password or typed phrase) → signed out, can't sign in, data removed or queued per the stated policy, and a confirmation email arrives
- [medium · agent] Deleted user's content, shared items, subscriptions and files → handled as documented (removed, anonymized, or transferred); no orphan pages or broken links
- [medium · agent] Sign up again with the same email after deletion → works, and shows none of the old data
- [medium · agent] Export my data (where offered) → file contains the user's data only, and opens correctly

### Interface and copy
- [medium · agent] Every auth form: labels, error text tied to fields, focus moves to the first error, show-password toggle works by keyboard {a11y}
- [low · agent] Auth emails: subject, sender name, links point to the right environment (not localhost or a staging URL in production-like config), unsubscribe is not offered on security mail

## Gates

- Two-account isolation sweep passes with no leaks (every high-risk isolation line above).
- Reset, verification and magic links are single-use and expire.
- Session cookies are `HttpOnly` and `Secure`; no tokens in URLs.
- Admin and role checks are enforced by the server, not only hidden in the UI.
- For store apps: account deletion is available in the app (see `../gates/apple-app-store.md`, `../gates/google-play.md`).

## Human-only checks

- [human] Sign in once with each real social provider using your own account on a staging build → account lands correctly, avatar and name right, no permission over-asks on the consent screen
- [human] Real passkey or hardware key: register and sign in on your phone and laptop → prompts are clear and recovery works
- [human] Receive the real SMS or email code on your own phone and mailbox → arrives within a minute, code is readable, link opens the right app or page
- [human] Read the sign-up, reset and lockout messages as a new user → clear, not scary, not leaking whether an account exists

## Known pitfalls

- **Generic messages are correct.** "If that email exists, we sent a link" is the secure behavior, not a bug.
- **Dev bypasses.** A dev-only "sign in as" button or magic code is not a defect in a test environment; it is one if it exists in the production build or config.
- **Email delay.** Wait a short, fixed time and check the catcher before saying the email never arrived.
- **Cookie flags on localhost.** `Secure` may be missing on `http://localhost`; check it on the HTTPS deployment.
- **Shared test accounts.** Parallel testers using one account trip lockouts and rate limits; use one account per tester.
- **Cached 403s.** A CDN or browser cache can show an old protected page after logout; check the Back button and a hard reload before calling it.
- **JWTs aren't revocable by design.** A signed token staying valid until expiry after logout may be the documented design; compare to the docs and note it, but flag it when the docs promise immediate logout.
- Don't test real identity providers, real mailboxes or real phone numbers.

## Sources

1. [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — generic errors, lockout, reset, enumeration (checked 2026-11-16)
2. [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — cookie flags, fixation, expiry (checked 2026-11-16)
3. [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — reset tokens and messages (checked 2026-11-16)
4. [OWASP ASVS](https://asvs.owasp.org/) — authentication and access-control requirements (checked 2026-11-16)
5. [Mailpit](https://mailpit.axllent.org/) — local email catcher with web UI and API (checked 2026-11-16)
6. [Playwright authentication](https://playwright.dev/docs/auth) — storageState and multiple contexts (checked 2026-11-16)
7. Research notes: `11-vibe-coders.md` (AI-built apps often miss server-side access checks; row-level security gaps)
