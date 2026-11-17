---
module: security
kind: feature
title: Security basics
checked: 2026-11-16
---
# Security basics

A basics pass against the OWASP Top 10 and ASVS level 1. It is not a penetration test and doesn't replace one. The rule: **attack to prove, don't lint.** Don't report "a public key is present"; show what that key can read or write. Don't report "no CSRF token seen"; show a forged request changing state. Scope is the product's own systems and test environments only. Never probe third-party systems you don't own (payment providers, identity providers, SaaS APIs, hosting platforms), and never run exploits against production data. Goes with `accounts-auth.md`, `apis-backend.md`, `privacy-consent.md` and, for AI-built apps, `ai-built-app-risks.md` (which holds the data-layer and secrets attacks in more depth).

## Signals

- Any product with accounts, an API, a database, uploads, payments or user-generated content. Always on for web apps and backends.
- Config: `Authorization` headers, cookies, JWT libraries, ORM and query builders, `fetch`/`axios` on the server with user-supplied URLs, file-upload handlers, `child_process`/`exec`, template rendering of user text, GraphQL schemas, CORS config.
- Hosting config: `vercel.json`, `netlify.toml`, `nginx.conf`, Helmet, `next.config.js` headers, Supabase/Firebase config.

## Kickoff questions

1. Which environment may be attacked (local, staging, a throw-away deployment), and may I create two test accounts there? (best guess: local or staging, two accounts)
2. Which parts take user-controlled URLs, files, rich text or queries? (best guess: found from the code during recon)
3. Is there a stated security bar (ASVS level, SOC 2, a customer's questionnaire)? (best guess: ASVS level 1)

## Drivers

1. **Dependency and secret scanners.** `npm audit` / `pnpm audit` / `yarn npm audit`, `pip-audit`, `osv-scanner`, `cargo audit`, `bundler-audit`, `dotnet list package --vulnerable`, GitHub Dependabot alerts; `gitleaks detect` or `trufflehog` for repo history. Deterministic; run first and triage the output rather than rediscovering it.
2. **HTTP replay with `curl` or a script.** The most reliable way to prove authentication and authorisation problems. Capture requests from the app (Playwright network log or HAR), replay them with no token, with an expired token, with user A's token against user B's IDs. Compare status code and body.
3. **Playwright with two browser contexts.** Context A (user A), context B (user B), plus an anonymous context. Used for IDOR, session, CSRF and UI-only access checks. Observe with the network log and the accessibility tree, not screenshots.
4. **Header and TLS checks.** `curl -sI`, Mozilla Observatory (public sites only), `testssl.sh` on your own host, browser DevTools Security panel. Cheap and deterministic.
5. **OWASP ZAP baseline scan** (`zap-baseline.py`, passive only) against local or staging. Don't run its active scan against anything you don't own. Treat output as leads to verify.
6. **Targeted manual probes.** SQL, NoSQL, command injection and XSS payloads in the inputs that reach those sinks; an SSRF probe against a local listener you control (`python -m http.server` or a request-catcher you own); `sqlmap` only against a local test database.
7. **Static analysis.** Semgrep with `p/owasp-top-ten`, `bandit` (Python), `eslint-plugin-security`, CodeQL where available. Findings are leads; prove each by an exploit before filing high-risk.

**Can't be driven here:** social engineering, physical security, real-world phishing, supply-chain compromise of the hosting platform, cloud IAM review without access, a full pentest, and anything needing real third-party credentials. A person must also do any legal or contractual security review. Rate-limit and brute-force tests are limited to a throw-away environment with small counts.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Dependency audit, secret scan of the built bundle, one anonymous replay of the main API, one cross-user read |
| check | Smoke, plus every changed endpoint with anonymous, wrong-role and other-user requests |
| full | Every route and API call × (anonymous, user A, user B, admin if it exists, expired token) × the injection and header checks |
| release | Full, plus rate-limit, CSRF, SSRF and header checks on the deployed staging URL, plus a human review |

Dimensions: identity (none, user A, user B, admin, expired or tampered token), endpoint/method, input sink, environment.

## Check catalogue

### Authentication and session (A07 Authentication failures; ASVS V6, V7)
- [high · auto] Enumerate every route and API endpoint (from the router, OpenAPI file, network log, sitemap); call each with no credentials → each protected endpoint returns 401 or 403 and no data; public ones are intended to be public {smoke} {security}
- [high · agent] Login with a wrong password, a nonexistent user and a locked user → the same generic message and similar timing; no account enumeration {security}
- [high · agent] Brute force on a throw-away account: 20 wrong passwords in a minute → throttling, delay, CAPTCHA or lockout appears; the limit can't be bypassed by changing `X-Forwarded-For` {security}
- [high · agent] Session cookie flags → `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict` on session cookies; the session ID changes at login (no fixation) {security}
- [high · agent] Logout, then replay the old token or cookie → rejected; the server invalidates it, not only the browser {security}
- [medium · agent] Password reset: request twice, reuse a link, use an expired link, change the email in the request → the old link dies; links are single-use, expire, and don't reveal whether the email exists {security}
- [medium · auto] JWTs: decode a token → no secrets or PII in claims; the `alg` is not `none`; expiry is set; a tampered payload with the old signature is rejected; a placeholder signing secret is not accepted {security}
- [medium · agent] Weak passwords, breached passwords and very long passwords (over 128 chars) → minimum length is enforced (ASVS L1: at least 8 characters, 15 recommended per ASVS 5.0 requirement 6.2.1); no silent truncation; paste works {security}
- [medium · agent] MFA, if offered: skip the second step by calling the next endpoint directly → refused {security}
- [medium · agent] OAuth/OIDC: change `redirect_uri` to another host (to a host you own), drop `state`, reuse a code → rejected {security}
- [low · agent] Concurrent sessions and device list, where claimed → work as stated; revoking a device kills its token

### Authorisation and access control (A01 Broken access control; ASVS V8)
- [high · agent] Two test accounts. As user A, copy a request that reads user A's record; change the ID, UUID or slug to user B's (IDOR/BOLA) → 403 or 404, never B's data. Try GET, PUT, PATCH, DELETE {smoke} {security}
- [high · agent] List endpoints, search, exports, reports and downloads as user A → contain only A's data; counts and aggregates don't leak B's {security}
- [high · agent] As an ordinary user, call admin and staff endpoints directly (not through the UI) → 403; hiding the menu isn't a control {security}
- [high · agent] Open admin and internal URLs as anonymous and as a normal user (`/admin`, `/api/admin/*`, `/dashboard/all`) → redirect to login or 403, with no data in the response body {security}
- [high · agent] Change one's own role, plan, price, owner ID or `isAdmin` through a normal update request (mass assignment) → ignored or rejected {security}
- [medium · agent] Delete or edit a resource after losing access (removed from a team, plan downgraded, user deleted) → refused immediately {security}
- [medium · agent] Direct access to uploaded files and private URLs with no login, and with another user's login → blocked; signed URLs expire {security}
- [medium · agent] HTTP method switching (GET vs POST vs HEAD vs OPTIONS) and path tricks (`/api/users/../admin`, trailing slash, case change) → the same rule applies on every variant {security}
- [medium · agent] Function-level checks for each role in the role matrix → each role can do exactly what the matrix says, no more

### Injection (A05 Injection; ASVS V1)
- [high · agent] Inputs that reach a SQL or ORM raw query (search, filters, sort-by, IDs): `'`, `"`, `' OR '1'='1`, `1; SELECT pg_sleep(2)--` → no SQL error, no changed result set, no delay; parameterised queries {security}
- [high · agent] NoSQL operators in JSON and query strings: `{"$ne": null}`, `{"$gt": ""}`, `[$ne]=1` in login and search → treated as plain values, not operators {security}
- [medium · agent] Command injection where the server runs commands (image conversion, PDF, git, ping, file names): `; id`, `$(id)`, `` `id` ``, `| whoami` → output never executes; arguments are passed as arrays, not shell strings {security}
- [medium · agent] Template, header, log and path injection: `{{7*7}}`, `../../etc/passwd`, `%0d%0aSet-Cookie:`, CRLF in a redirect parameter → treated as text; no `49` rendered, no file read, no extra header {security}
- [medium · agent] GraphQL: introspection in production, deep nesting, huge aliases and batch queries → disabled or limited; field-level auth enforced {security}
- [low · auto] Static analysis for string-built queries and `eval`/`exec`/`innerHTML` → each hit is proven reachable or dismissed

### XSS, CSRF and the browser (A05, A02; ASVS V3)
- [high · agent] Stored XSS: save `<img src=x onerror=alert(1)>` and `"><script>alert(1)</script>` in every field that is shown to others (names, comments, titles, filenames, profile bios) → shown as text; no script runs; check where it appears in lists, emails, admin pages and exports {smoke} {security}
- [high · agent] Reflected and DOM XSS: put payloads in query strings, hash fragments and `postMessage` where the page reads them → not executed; `innerHTML`, `dangerouslySetInnerHTML` and `v-html` use sanitised input only {security}
- [high · agent] CSRF: with user A logged in, submit a cross-site form or `fetch` from a different origin to a state-changing endpoint without the token → rejected (token, `SameSite` cookie plus origin check, or custom header); GET requests don't change state {security}
- [medium · agent] Rich text, Markdown and SVG upload → scripts, `javascript:` URLs and event handlers are removed; uploaded SVG and HTML are not served inline from the app's origin {security}
- [medium · agent] Open redirect: `?next=https://example.invalid` after login or logout → refused or limited to the same site {security}
- [medium · agent] Clickjacking: embed the page in an iframe on another origin → blocked by `X-Frame-Options` or CSP `frame-ancestors` for pages with actions {security}
- [medium · agent] `target="_blank"` links to external sites → have `rel="noopener"` (browsers default this now, so this is low) {security}

### SSRF (A01 includes SSRF in the 2025 list; ASVS V1, V12)
- [high · agent] Wherever the server fetches a user-supplied URL (link previews, webhooks, import by URL, avatar from URL, PDF from URL): point it at a listener you control, `http://127.0.0.1`, `http://localhost`, `http://169.254.169.254/` (cloud metadata), `http://[::1]`, `file:///etc/passwd` and a redirect to an internal address → internal, loopback, link-local and private ranges are refused; only http(s) allowed; redirects re-checked; the response body isn't returned raw {security}
- [medium · agent] DNS rebinding and decimal/octal IP forms (`http://2130706433`, `http://0x7f.1`) → refused {security}
- [low · agent] Response size and time limits on fetches → large or slow targets are cut off

### Security headers, TLS and CORS (A02 Security misconfiguration)
- [high · auto] `curl -sI` on the HTML and API responses → `Strict-Transport-Security` (on HTTPS), `Content-Type` with `X-Content-Type-Options: nosniff`, a Content-Security-Policy, frame protection, `Referrer-Policy`; missing headers are listed with the page they were missing from {security}
- [medium · agent] CSP quality: look for `unsafe-inline`, `unsafe-eval` and wildcard sources → each is justified; a policy that blocks nothing is a finding of low priority
- [high · agent] CORS: send `Origin: https://evil.example` to authenticated API endpoints → the response doesn't echo it with `Access-Control-Allow-Credentials: true`; no wildcard origin with credentials {security}
- [medium · auto] TLS: HTTP redirects to HTTPS; modern protocol versions only; the certificate is valid and not expiring soon; no mixed content {security}
- [medium · agent] Cookies on all hosts (`Domain` too broad, no `__Host-` prefix on sensitive ones) → flags as in the session check {security}
- [medium · agent] Directory listings, `.git/`, `.env`, `/debug`, `/admin`, `/actuator`, `/swagger`, backup and `.map` files on the deployed host → not served; debug and docs endpoints are off or protected {security}
- [low · agent] Server and framework version banners → not needed to exploit; note only

### Secrets and sensitive data (A04 Cryptographic failures; A02)
- [high · auto] Grep the built bundle, HTML, source maps and network responses for key patterns (`sk_live_`, `AKIA`, `eyJ`-style service JWTs, `-----BEGIN`, `password=`, `secret`, provider-specific prefixes); classify each hit as public by design (a publishable or anon key) or secret → no secret keys in anything the browser receives {smoke} {security}
- [high · auto] `gitleaks detect` or `trufflehog git` on the repository and its history → no live secrets; found ones are marked for rotation, not just deletion {security}
- [medium · agent] Logs, error pages and API errors (provoke a 500) → no tokens, passwords, stack traces, file paths, SQL text or other users' data {security}
- [medium · agent] Sensitive data at rest and in URLs → no passwords, tokens or personal data in query strings; passwords hashed with a slow hash (bcrypt, scrypt, Argon2) when the code is visible {security}
- [medium · agent] Responses return only the fields the screen needs (excessive data exposure): compare API JSON to what the UI shows → no password hashes, internal IDs, other users' emails or flags {security}
- [medium · agent] Client storage (`localStorage`, `IndexedDB`, mobile local files) → no long-lived secrets or full personal data where an XSS or a stolen phone would reveal them {security}

### Abuse controls and business logic (A06 Insecure design)
- [high · agent] Rate limit expensive and sensitive endpoints in a throw-away environment (login, sign-up, reset, search, export, email/SMS send, AI calls): small burst of 30 requests → 429s or equivalent; limits keyed to account and IP, not a spoofable header {security}
- [medium · agent] Spend and quota abuse: can one user trigger unbounded paid calls (AI, email, SMS, storage)? → per-user caps, global budget alerts or caps exist {security}
- [medium · agent] Negative, zero and huge quantities and prices, repeated coupon use, replayed requests, skipped steps in a flow (call "confirm" without "pay") → rejected server-side; the server recomputes totals {security}
- [medium · agent] Race conditions: send the same single-use action (redeem, withdraw, vote) twice in parallel → only one succeeds
- [medium · agent] Registration: disposable emails, email confirmation off, automated sign-ups → controls match the product's stated policy

### File upload (see also `file-upload-download.md`)
- [high · agent] Upload a file with a wrong extension, a double extension (`a.php.jpg`), a mismatched content type, an oversized file and an SVG/HTML with script → type checked on the server by content; size limited; stored outside the web root or served with safe headers {security}
- [medium · agent] Path traversal in file names (`../../x`) and zip slip in archives → names sanitised; extraction stays inside the target folder {security}

### Dependencies and supply chain (A03 Software supply chain failures; A06 in 2021)
- [high · auto] `npm audit --omit=dev` (or `pip-audit`, `osv-scanner`) → no known critical or high vulnerabilities in reachable production dependencies; each one found has a version to upgrade to or an accepted-risk note {smoke} {security}
- [medium · auto] Lockfile committed and used in CI (`npm ci`); no `*` or `latest` versions; packages exist and are spelled correctly (typosquats, AI-hallucinated package names) → true {security}
- [medium · auto] Install scripts and unusual postinstall hooks of new dependencies → reviewed
- [low · auto] End-of-life runtime or framework versions → listed

### Logging and error handling (A09, A10)
- [medium · agent] Failed logins, access denials and admin actions → logged with who, what and when, without secrets; an alert path exists where claimed
- [medium · agent] Unexpected errors (malformed JSON, huge body, wrong content type, unicode edge, dropped DB) → a generic error to the user, a safe state, no half-applied change, fails closed not open (access denied rather than granted) {security}

## Gates

- Release is blocked by any proven cross-user data read, unauthenticated write to protected data, live secret exposed to the client, or critical dependency vulnerability that is reachable.
- Store and certifier gates have their own security rules; see the platform gate files.
- For privacy law and breach duties see `../gates/privacy-law.md`.

## Human-only checks

- [human] Threat-model review: list the assets (accounts, payments, personal data) and the ways in → the biggest risks match the checks run.
- [human] Review who has access to the hosting, database, source repository and payment dashboard → least privilege, two-factor authentication on, more than one owner.
- [human] Rotate any key that was ever in a client bundle, repo or log, in the provider's dashboard → the old key is revoked.
- [human] Decide whether to commission a real penetration test before launch if the product holds payments, health data or children's data.

## Known pitfalls

- **Public keys are public.** A Supabase anon/publishable key, Firebase web config, Stripe publishable key and Google Maps browser key are meant to be in the client. Report only what they can read or write, or an unrestricted Maps/LLM key's spend risk.
- **Missing header isn't always exploitable.** Report the header gap at low or medium unless a real attack follows; don't pad a report with headers.
- **`npm audit` noise.** Dev-only dependencies, transitive paths that aren't reachable, and ReDoS in build tools are usually low. Check reachability.
- **ZAP and scanner findings are leads.** Prove them before filing.
- **A 200 with an error body is not a pass.** Many APIs return 200 with `{"error": ...}`; check the body.
- **A 404 can be the right answer.** Returning 404 for another user's resource is acceptable and better than 403 for hiding existence.
- **Test accounts only.** Don't attack real users' data, the production database, or third-party services; a scanner pointed at a hosted provider can breach its terms.
- **Intended public data.** Public profiles, listings and shared links are not IDOR if the product says they are public.
- **Rate-limit tests can lock you out.** Use a throw-away account and a small count.
- **Don't confuse the OWASP list year.** Name the edition you used. OWASP Top 10:2025 adds software supply chain failures and mishandling of exceptional conditions and folds SSRF into broken access control.

## Sources

1. [OWASP Top 10:2025 introduction](https://top10.owasp.org/2025/0x00_2025-Introduction) — the 2025 categories (checked 2026-11-16)
2. [OWASP ASVS](https://asvs.owasp.org/) — ASVS 5.0.0 (30 May 2025), level 1 about 20% of requirements (checked 2026-11-16)
3. [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) — test categories (checked 2026-11-16)
4. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — session, CSRF, SSRF, injection defences (checked 2026-11-16)
5. [OWASP API Security Top 10 2023](https://owasp.org/API-Security/) — BOLA, BFLA, SSRF, resource consumption (checked 2026-11-16)
6. [Tenzai: Bad Vibes](https://tenzai.com/blog/bad-vibes-comparing-the-secure-coding-capabilities-of-popular-coding-agents) — SSRF, CSRF, headers and rate limits missing in agent-built apps (checked 2026-11-16)
7. [Supabase security checklist](https://supabase.com/docs/guides/security/production-checklist) — anon key is public; RLS is the control (checked 2026-11-16)
