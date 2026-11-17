---
module: ai-built-app-risks
kind: feature
title: Defects typical of AI-built apps
checked: 2026-11-16
---
# Defects typical of AI-built apps

Switch this pack on for any app built mostly by AI agents or app builders (Lovable, Bolt, Replit, Base44, v0, Cursor, Claude Code, Codex). It orders the checks by how strong the evidence is that each defect class really occurs, strongest first, following the ranking in research note 11 §1.7 and DESIGN.md §10.3. The first three classes (open data layer, broken authorisation, exposed secrets) have been found in thousands of public apps and have caused real incidents; they run on every pass, even the cheapest.

The rule for everything here: **attack to prove, don't lint.** Don't report "anon key found in bundle"; show what that key can read or write. Don't report "no RLS policy seen"; show an anonymous read returning rows. Don't report "success toast shown"; show the database row, the email in the catcher or the stored file. Findings that are proven get high priority; findings that are only suspicions are listed as leads.

Scope and safety: only the user's own project, a staging copy or a throw-away deployment, with two test accounts the skill creates. Production is read-only, and the attacks that write (anonymous insert, update, delete) run only on staging or local. Never touch other people's apps, never test the builder platform itself (Lovable, Supabase, Firebase, Vercel are third parties), never use real customer data. Goes with `security.md` (general OWASP checks), `privacy-consent.md`, `accounts-auth.md`, `payments-subscriptions.md`, `../gates/web-launch.md` (the 14-check launch gate) and the matching platform module (`web-app.md`, `apis-backend.md`).

## Signals

- Repository or hosting traces of builders: `.lovable/`, `lovable-tagger` or `@lovable` in `package.json`, `.bolt/`, `.replit`/`replit.nix`, `base44` SDK (`@base44/sdk`), `v0` (`@v0`), `.cursor/` rules, `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.windsurf/`, a `*.lovable.app`, `*.bolt.host`, `*.replit.app`, `*.base44.app` or `*.vercel.app` URL.
- Backends typical of these apps: `@supabase/supabase-js`, `supabase/migrations/`, `supabase/config.toml`, `firebase`, `firestore.rules`, `storage.rules`, `database.rules.json`, Clerk, Convex, Neon, Stripe Checkout with edge functions.
- Commit history of large agent-style commits, generated README, boilerplate comments, many "fix" commits in a row.
- The user says "I vibe-coded it", "the AI built it", "I don't read the code".
- Tell-tale code: `NEXT_PUBLIC_` or `VITE_` variables holding secrets, hard-coded keys, `supersecretkey`-style JWT secrets, `service_role` in client code, `TODO`/mock data/`Lorem ipsum` in production paths, `catch {}` blocks that swallow errors, `expect.anything()` assertions.

## Kickoff questions

1. Which builder and backend does it use, and where is it deployed? (best guess: read from the signals above; ask only if there are none)
2. May I create two throw-away test accounts and attack a staging or local copy (never production) with them? (best guess: yes, local or staging with a separate database)
3. Do you want the platform's own scanner results used as input, and may I run them? (best guess: yes, run Supabase Security Advisor and the builder's scan, then dedupe)

## Drivers

Best first; the cheap deterministic ones carry most of the evidence.

1. **`curl` or a script with only the public key.** The core driver for classes 1 and 2. Take the project URL and public key from the client bundle (the way an attacker would) and call the data API with no login, then with user A's login. Supabase REST patterns (replace values; staging only): `curl "$SUPABASE_URL/rest/v1/<table>?select=*&limit=5" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"`; writes with `-X POST|PATCH|DELETE` and `-H "Content-Type: application/json"`; functions at `/rest/v1/rpc/<function>`; storage at `/storage/v1/object/list/<bucket>` and `/storage/v1/object/public/<bucket>/<path>`; sign-up at `/auth/v1/signup`. Firebase patterns: Firestore REST `https://firestore.googleapis.com/v1/projects/<id>/databases/(default)/documents/<collection>`, Realtime Database `https://<db>.firebaseio.com/<path>.json`, Storage `https://firebasestorage.googleapis.com/v0/b/<bucket>/o`. A 200 with rows, or a successful write, is the proof. The table list often comes from the app's own queries in the network log, the generated types file (`types.ts` / `database.types.ts`), migrations, or a schema endpoint if enabled.
2. **Two Playwright browser contexts plus an anonymous one.** For IDOR, UI-only admin, session and page access. Record the network log (HAR) while using the app as user A, then replay each captured request with no token and with user B's token or IDs. Observe by the network log and accessibility tree; screenshots are only for layout.
3. **Secret and dependency scanners.** `gitleaks detect` and `trufflehog git file://.` on the repository and its history; `grep -rE` over `dist/`/`.next/static/` and source maps for key patterns; `npm audit`, `osv-scanner`. Cheap, deterministic.
4. **SQL against the database (staging, read-only role).** Where the agent has database access: `select schemaname, tablename, rowsecurity from pg_tables where schemaname='public'` for tables without RLS; `select * from pg_policies` to read policies (a policy of `using (true)` is as open as no policy); check `GRANT` on `anon`/`authenticated` roles; views without `security_invoker`; `SECURITY DEFINER` functions exposed through the API. Policy text is a lead; the anonymous request is the proof.
5. **The platform's own scanner, read first** (see "Reading the platform scanners" below).
6. **Playwright end-state assertions.** For class 4: drive each control, then assert the end state by a second route (database query on staging, API GET, mail catcher, file listing), not by the toast.
7. **Repo search for placeholders and stubs.** `rg -i "TODO|FIXME|lorem|placeholder|mock|dummy|example\.com|coming soon|not implemented|console\.log"`, hard-coded arrays that stand in for data, handlers that `return` immediately, `try { } catch (e) { }` with an empty body.
8. **Regression set runner.** Playwright (or the project's test runner) running the growing set of user-flow tests after every change.
9. **Agent exploration with the cheap-observation rules.** Scoped accessibility trees, batch actions then observe once, screenshots only at 1280×800 or smaller and at 390px width for layout.

**Can't be driven here:** the builder platform's internal flaws (Base44 and Lovable platform bugs are outside the app), anything on other people's apps, real payments, billing settings in dashboards, and inbox codes. Whether a policy expresses the owner's business rules (who should see what) needs the owner's answer. Those become human checks or questions.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Class 1 anonymous read of every table, bucket and RPC (read-only), class 3 bundle secret grep, class 4 one end-state assertion on the main flow |
| check | Smoke, plus classes 1 to 4 on every changed table, route and control, plus the regression set |
| full | All seven classes: every table, bucket, RPC and route × (anonymous, user A, user B, admin) × operation (read, insert, update, delete); full stub sweep; abuse controls; prod/dev checks; phone width and empty/error states |
| release | Full on the deployed staging copy, then the read-only subset on production; platform scanners re-run; the 14-check launch gate (`../gates/web-launch.md`) |

Dimensions: identity (anonymous, user A, user B, admin, expired token), data object (table, view, bucket, RPC, route), operation, environment (local, staging, production read-only), platform and build version.

## Check catalogue

### 1. Data layer open to the public key (strongest evidence)
- [high · auto] List every table, view, storage bucket and RPC function the app uses (from the client code, generated types, migrations and the network log); keep the list as the attack surface → a complete inventory exists in `qa/notes.md` before testing starts {smoke} {security}
- [high · auto] Read test: with only the public key (anon or publishable key, no login), `select` from every inventoried table and view → every sensitive table returns 401/403 or zero rows; any rows returned are shown to the owner as proof, with a count and 2 redacted sample fields {smoke} {security}
- [high · auto] Write test on staging: with only the public key, `insert` a clearly marked test row (`qa-anon-test`), `update` and `delete` it, then try to update and delete a row that belongs to a test user → all refused; if any succeeds, that is critical {security}
- [high · agent] Cross-user test with two test accounts: as user A, read, update and delete user B's rows through the data API (not the UI), by changing IDs, filters (`user_id=eq.<B>`) and `select=*` → refused or empty; B's data never appears in A's results {smoke} {security}
- [high · agent] Check policy quality, not only existence: look for `using (true)`, `with check (true)`, policies on `auth.role() = 'authenticated'` only, and policies that trust a column the client can set (`user_id` in the insert body) → a user can insert only rows owned by themselves; they can't change the owner column afterwards {security}
- [high · auto] Tables without row-level security (`rowsecurity = false`) and tables in `public` with `GRANT` to `anon` or `authenticated` → none that hold user data; each exception is a deliberately public table the owner confirms {security}
- [high · agent] Views and materialised views over private tables → run as `security_invoker` or are not exposed; the anonymous read of the view returns no private rows {security}
- [high · agent] RPC and database functions exposed through the API (`/rest/v1/rpc/*`), especially `SECURITY DEFINER` ones → each checks the caller (`auth.uid()`); anonymous and other-user calls are refused; functions with dynamic SQL are flagged {security}
- [high · agent] Storage buckets: list and download objects anonymously and as user B from a bucket that holds user A's files; try guessable names and predictable paths → private buckets refuse; public buckets contain only intended public files; upload and delete by anon is refused {security}
- [high · agent] Firebase: anonymous reads and writes to Firestore collections, Realtime Database root (`/.json`) and Storage with no auth; then as user B on A's documents → refused; rules aren't `allow read, write: if true` or time-limited test rules left in place; App Check is enforced where the product relies on it {security}
- [high · auto] Auth configuration through the public endpoints: can anyone sign up when the product is invite-only, is email confirmation required, can a self-signed-up user pick their own role in the sign-up payload (`data`/metadata) → true to the product's policy; no role or admin flag settable from client metadata {security}
- [high · auto] Service-role or admin keys: decode every JWT found in the client (`role` claim) → none has `service_role` or admin rights; a service key in the client is critical and the key must be rotated {security}
- [medium · agent] Realtime channels and subscriptions: subscribe as anon and as user B to user A's channel or table changes → no events delivered {security}
- [medium · agent] After a new table, view or function is added by a later edit, repeat read and write tests on it → the new object is private by default; on Supabase, a missing `GRANT` after the grants default change shows as a permission error for the real client, which the feature must handle (see class 5) {security}
- [medium · agent] The data a page needs vs the data returned: compare the API response to what the screen shows → no extra private columns (emails, flags, internal notes, hashes) ride along on a public list {security}

### 2. Broken authorisation on endpoints and pages
- [high · auto] Enumerate every API route, edge function, server action and page route (router files, OpenAPI, network log, sitemap) and call each with no token → each protected one returns 401/403 with no body data; public ones are intentionally public {smoke} {security}
- [high · agent] IDOR/BOLA with two accounts on every route that takes an ID, slug or email: replay A's request with B's identifiers, for GET, PUT, PATCH and DELETE → 403 or 404, never B's data or a changed B record {smoke} {security}
- [high · agent] Admin and staff pages and APIs hidden only in the UI: open `/admin`, `/dashboard/admin`, `/api/admin/*`, internal tools and "debug" pages as anonymous and as a normal user, and call the admin API directly → refused on the server; the menu being hidden proves nothing {security}
- [high · agent] Privilege fields: send `role`, `isAdmin`, `plan`, `credits`, `owner_id`, `price` in a normal create or update request (mass assignment) → ignored or rejected {security}
- [high · agent] Edge functions and serverless routes that use a service key internally → they check the caller's identity and ownership themselves; calling them with another user's ID or no token is refused {security}
- [medium · agent] Client-only gates: a paywall, a plan limit, a feature flag, a "locked" step checked only in the browser → bypass by calling the API directly; the server enforces it {security}
- [medium · agent] Signed-in state checks on direct URL entry and deep links: log out in another tab, then act in the first → the next request is refused and the UI sends the user to sign in
- [medium · agent] Authorisation after state changes: remove a user from a team, downgrade a plan, delete an account → access ends at once; old tokens stop working {security}
- [medium · agent] Auth provider misconfiguration: unused sign-in providers enabled, password reset that reveals accounts, open redirect after login, magic links reusable → refused or fixed {security}

### 3. Exposed secrets in bundles, source maps, git history and logs
- [high · auto] Grep the production bundle, HTML, JSON, and the network responses for key patterns (`sk_live_`, `sk_test_`, `rk_`, `whsec_`, `AKIA`, `AIza` (Google keys), `eyJ…` JWTs, `-----BEGIN`, `xox[bp]-`, `ghp_`, `sk-` / `sk-ant-` LLM keys, `SUPABASE_SERVICE`, `service_role`, `postgres://…:…@`) → no secret keys; each hit is classified as public by design (a Supabase anon/publishable key, Firebase web config, Stripe publishable key) or secret {smoke} {security}
- [high · auto] Fetch `*.js.map` for the deployed bundles and any `/.env`, `/.git/config`, `/config.json` → not served in production (or the maps contain no secrets and the owner chose to ship them) {security}
- [high · auto] `gitleaks detect --log-opts="--all"` or `trufflehog git file://.` over all branches and history → no live secrets; each found secret is marked "rotate", because deleting it from the latest commit doesn't remove it from history {security}
- [high · auto] Environment variables with `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `EXPO_PUBLIC_` prefixes → none holds a secret (service role, Stripe secret, database URL, LLM key, webhook secret); these ship to the browser {security}
- [medium · auto] Placeholder or default secrets in code and config (`supersecretkey`, `secret123`, `your-secret-key-change-in-production`, `changeme`, default admin passwords, `.env.example` values used in production) → none; the JWT signing secret isn't a known string {security}
- [medium · agent] Keys that are public by design but need restriction (Google Maps browser key, Firebase API key, an LLM key proxied by the client) → restricted by domain and API in the provider's dashboard (human confirms), and any key that bills per use has a spend cap or alert {security}
- [medium · agent] Logs, error pages and API errors (provoke a 500 and a failed login) → no tokens, secrets, stack traces, SQL, file paths or other users' data; debug logging is off in production {security}
- [medium · agent] AI features: the system prompt, API keys and other users' conversations aren't returned by any endpoint or in the client code; prompts aren't a place for secrets {security}
- [medium · agent] Keys that were ever in the repo, a chat with the agent, a screenshot or a public project → rotated by the owner (human step); the old key is revoked {security}
- [low · auto] MCP and agent config files (`.cursor/mcp.json`, `.claude/`, `mcp.json`) → contain no tokens that are committed {security}

### 4. "Looks done, isn't": stubs, unwired buttons, placeholder data, swallowed errors
- [high · agent] Click every button, link, menu item, tab, toggle and form submit in the app; for each, assert the end state through a second route (database row on staging, API GET, email in the catcher, file in storage, a changed record on reload) → each control does what its label says; none is inert, navigates nowhere, or only shows a toast {smoke}
- [high · agent] Force a server-side failure (stop the backend, return 500 from a mock, revoke a permission, break a constraint) and use each write path → the UI reports a failure; it never says "saved" or "setup complete" over an empty database; no swallowed error {smoke}
- [high · agent] Reload and re-open after each create, edit and delete → the change is still there (or gone); optimistic UI that only changed local state is caught
- [high · agent] Search the source for hard-coded data standing in for real data (arrays of fake users, static dashboards, constant "revenue" numbers, `Math.random()` charts) and compare each dashboard figure to the database → every number on screen is computed from real data {smoke}
- [medium · auto] Search for `TODO`, `FIXME`, `lorem`, "coming soon", `example.com`, `test@`, `not implemented`, stub functions that return fixed values or just `console.log` → none in user-facing paths; each hit is explained or filed
- [medium · agent] Features named in the README, landing page or pricing table → each exists and works (the "claims tour"); a listed integration actually connects, a listed export actually exports
- [medium · agent] Email, SMS, push and webhook side effects (welcome mail, reset mail, invoice, notification) → the message arrives in the catcher with the right content and links, once; reset and confirmation links work
- [medium · agent] Payments in test mode: the full checkout, then confirm the order, entitlement and receipt exist and match the amount, and that the webhook (not only the redirect) granted access (see `payments-subscriptions.md`)
- [medium · agent] Async work (file processing, AI generation, imports, scheduled jobs): wait for completion and check the result and the status shown → status matches reality; failures are surfaced and retryable
- [medium · agent] Tests in the repo: break the code on purpose (revert a fix, return a wrong value) and run the suite → at least one test fails; green tests with `expect.anything()`, mocks of the thing under test, skipped or deleted tests are findings
- [medium · agent] Browser-native dialogs (`alert`, `confirm`, `prompt`, file pickers) → handled in the test driver and in the flow; these are a blind spot of agent builders and testers
- [medium · agent] Dead routes, broken links and unknown URLs → each internal link resolves; an unknown route returns a real 404 page, not a blank app or the home page with status 200
- [low · agent] Default text and branding left from templates (the builder's logo, "My App", the template's favicon, a placeholder privacy policy) → replaced

### 5. Regressions after later edits
- [high · auto] Keep a growing regression set: every verified bug becomes a named, repeatable flow test; every build runs the smoke test plus the flows touched by the diff → no flow that passed before fails now {smoke}
- [high · agent] After each agent change, re-test the neighbours: features that share the changed table, component, route, hook or style → still work; list the areas touched by `git diff --stat` and check each
- [medium · auto] Re-run the class 1 and 2 attack tests after every schema change, migration, new endpoint or auth edit → no access that was closed has re-opened
- [medium · agent] Migrations: apply to a copy of real-shaped data → no data loss, no changed meaning, no duplicate writes; old rows still display; new `NOT NULL` columns and renamed fields don't break old records
- [medium · agent] Edits outside the requested scope: compare the diff to the prompt → no unrelated files changed, no tests or hash-locked files edited, no settings or policies relaxed to "make it work"
- [medium · agent] Previous-version data and sessions after an update (see `settings-persistence.md`, `installers-updaters.md`) → still load
- [medium · agent] Fix loops: a bug marked fixed → re-run the exact original reproduction; the verifier, not the fixer, decides it's fixed

### 6. Missing abuse controls
- [high · agent] Rate limits on sign-up, login, password reset, OTP/email send, search, export, comment/post and every AI or paid-API endpoint: a small burst (about 30 requests in a minute) on staging with a throw-away account → throttled (429, delay, lock) and not bypassable by changing `X-Forwarded-For` {security}
- [high · agent] Spend caps: can one user trigger unbounded paid calls (LLM tokens, email, SMS, storage, maps)? → per-user quotas, request size limits and a provider budget alert or cap exist; the owner confirms the provider dashboard setting (human) {security}
- [high · agent] CSRF: submit a forged cross-origin request to each state-changing endpoint with the user's cookies → rejected (token, `SameSite` plus origin check, or custom header); bearer-token APIs that don't use cookies are not vulnerable {security}
- [medium · auto] Security headers on HTML and API responses (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, frame protection, `Referrer-Policy`) and CORS not set to `*` with credentials → present or the gaps listed at low to medium priority {security}
- [medium · agent] Email confirmation, CAPTCHA or bot protection on sign-up where abuse would cost money or spam users; disposable email policy → matches the product's stated policy
- [medium · agent] Email sending limits: the platform's default email sender caps (Supabase's built-in email allows 2 emails an hour project-wide until custom SMTP is set) → sign-up and reset still work under launch load; custom SMTP, SPF, DKIM and DMARC are set
- [medium · agent] File upload limits and types, and image or video processing limits → enforced on the server (see `file-upload-download.md`) {security}
- [medium · agent] Account enumeration and reset abuse → generic messages; no way to spam another user with reset emails

### 7. Business logic, prod/dev mix-ups, injection, UX states and SEO
- [high · agent] Business logic: negative, zero, huge and fractional quantities and prices, repeated coupons, replayed or double-submitted checkout, skipping a step by calling the next endpoint → rejected server-side; the server recomputes totals; one order for a double click {security}
- [high · agent] Payment state: duplicate and out-of-order webhooks in test mode → the ledger balances and access matches payment state (see `integrations-webhooks.md`)
- [high · auto] Prod/dev separation: environment variables, database, auth provider, storage and payment keys → production uses production values; no test-mode Stripe objects live; no dev database in production; the agent can't reach production from its dev environment without a guard {security}
- [medium · agent] Test data and debug leftovers in production: test accounts, test phone numbers (Supabase advises removing them), seed rows, debug flags, verbose errors, `/debug` routes, open Swagger → none
- [medium · agent] Injection where the feature exists: SQL/NoSQL operators in search and login (`{"$ne":null}`), command injection in file or image handling, template injection → not executed (see `security.md`); the evidence says SQL injection and XSS are rarer in framework code, so don't spend most of the time here {security}
- [medium · agent] SSRF where the server fetches a user-supplied URL (link preview, import by URL, image from URL, webhook target): point at a listener you own, `http://127.0.0.1`, `http://169.254.169.254/` → refused; this was found in all five agents in one study {security}
- [medium · agent] XSS in rich text, Markdown, names and comments (`<img src=x onerror=…>`) → shown as text; no script runs {security}
- [medium · agent] Prompt injection where there's an AI feature that reads user content or the web: hide an instruction in a document or page → the assistant doesn't follow it to leak data or call tools (see `ai-llm-features.md`) {security}
- [high · agent] Loading, empty and error states on every screen: throttle the network, use a brand-new empty account, force an API error → a visible loading state, a helpful empty state and a human error message with a way out; no blank page or raw stack
- [medium · agent] Phone width (375–390 px), landscape and 200% zoom → no fixed-height panels leaving the screen empty, no horizontal scroll, targets reachable; viewport meta present and zoom not blocked
- [medium · agent] Client-rendered SEO: fetch the raw HTML without JavaScript (`curl -s <url>`) for the home page and two content routes → a real `<h1>` and content, a unique `<title>`, meta description, canonical link and Open Graph tags per route; sitemap and robots exist; unknown routes return 404 (see `../platforms/website-content.md`)
- [medium · agent] Hosting defaults: project visibility (public by default on some builders, preview deployments protected?), free-tier pausing (Supabase free projects pause after a week of low use), and backups (free plans have none; storage files are excluded) → the owner has chosen consciously; a restore drill or accepted risk is recorded
- [medium · agent] Accessibility smoke (axe plus keyboard on the core flow) → see `accessibility.md`; generated UIs often fail on labels and alt text {a11y}
- [low · agent] Analytics present and consent-aware, error tracking receives a test error, a legal pages set exists → see `analytics-events.md`, `privacy-consent.md`, `../gates/web-launch.md`
- [low · auto] Performance smoke: Lighthouse on two pages, large unoptimised images and bundles, missing database indexes where visible → recorded as baseline (see `performance.md`)

### Reading the platform scanners and deduping
- [high · auto] Run or read each platform scanner that applies, before the attack tests: Supabase Security Advisor, Lovable security scan (quick scan on publish, deep scan on demand), Bolt security audit on publish, Replit Security Agent and any pen-test report, Base44 security scan → the raw findings are saved to `qa/evidence/` with the tool name, date and project version {smoke}
- [high · agent] Triage each scanner finding against the attack tests: confirm it by an exploit → a finding is "confirmed" (exploit worked), "not reproducible" (the exploit failed; say why), or "lead" (can't be tested here); only confirmed ones get severity from impact
- [high · agent] Dedupe: merge a scanner finding and an attack test that point to the same defect into one bug, naming both sources → one bug per root cause (for example one open table = one bug, even if the advisor, the builder scan and the anonymous read all report it)
- [medium · agent] Gaps in the scanners: note what each tool doesn't cover (for example, a scanner that checks only whether a policy exists, not that it is correct; quick scans that skip app code; scanners that warn but don't block publishing) → the attack tests cover those gaps; the report lists scanner clean-bills as "not proof"
- [medium · agent] Warnings the scanner raises about public-by-design items (anon key in the bundle) → closed as false positive with the reason, not filed
- [medium · agent] Platform advisories and changed defaults (Supabase's table-exposure change dated 30 May 2026 for new projects and 30 October 2026 for existing ones; Lovable private-by-default projects since December 2025; Lovable server rendering for apps created from 13 May 2026) → the project's platform settings are recorded and each default that applies is checked against the actual project

## Gates

- Run class 1, 2 and 3 on every pass. Release is blocked by any proven anonymous or cross-user data access, a secret key in anything the browser receives, an unauthenticated admin function, or a stub on a core flow that reports success it didn't achieve.
- The 14-check launch gate against the deployed URL: `../gates/web-launch.md`. Classes 1 to 3 here are its L1, L2 and part of L3; class 6 is L4; class 7 is L6, L11, L12 and L14.
- Privacy and legal pages: `../gates/privacy-law.md`.

## Human-only checks

- [human] Confirm in the Supabase, Firebase, Vercel and payment dashboards: two-factor authentication on, more than one owner, billing alerts or caps set, keys restricted, backups enabled on the plan, production and development kept separate.
- [human] Rotate every key that was ever in a client bundle, repository, log, chat with an agent or screenshot, and confirm the old one is revoked.
- [human] Review each table's access rules against what each role should be allowed to do (the business rule); an agent can prove what is open, but only the owner knows what should be open.
- [human] Do one real low-value purchase and refund in live mode, and check the receipt, webhook and entitlement.
- [human] Open the app on a real phone and real network, and use the main flow as a stranger would.
- [human] Read the privacy policy, terms and refund text; confirm they describe what the app really does.

## Known pitfalls

- **The anon or publishable key in the bundle is not a finding.** Supabase and Firebase design those keys to be public. The finding is what the key can read or write.
- **"RLS enabled" is not "RLS correct".** A table can have RLS on and still be open through `using (true)`, a view, or a function. Always test with requests.
- **An empty result isn't always safe.** An anonymous read that returns `[]` may just mean the test table is empty; insert a test row (staging) or use a seeded user's row and retry.
- **A 200 with an error body isn't a pass,** and a 404 for another user's record is a good answer.
- **Scanner headline numbers inflate.** Missing headers and the public key counted as findings make "98% have flaws" misleading; weigh by proven impact.
- **Don't test production with writes.** Read-only on production; destructive and write attacks on staging or local only.
- **Don't attack the platform.** Lovable, Supabase, Firebase and Vercel are third parties; report platform-level suspicions to the user and stop.
- **Toasts lie.** A success message with an empty database is the defect; check the end state.
- **Dev-mode behaviour.** Preview builds, hot reload and development logging differ from the deployed build; test the deployed URL.
- **Agents may "fix" a finding by hiding it** (catching the error, relaxing the test, editing the policy to `true`). A verifier re-runs the original proof.
- **Seeded and test data in the app** can look like "placeholder data" bugs when it is only staging; check production separately.
- **A key rotated by the owner invalidates your test setup.** Re-read configuration after rotation.

## Sources

1. [Matt Palmer: statement on CVE-2025-48757](https://mattpalmer.io/posts/statement-on-CVE-2025-48757/) — 170 of 1,645 Lovable apps exposed; the public key is by design (checked 2026-11-16)
2. [Wiz: Moltbook exposed database](https://www.wiz.io/blog/exposed-moltbook-database-reveals-millions-of-api-keys) — Supabase key in the bundle with RLS not enforced (checked 2026-11-16)
3. [Supabase changelog: tables not exposed to the Data API automatically](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) — grants default change (checked 2026-11-16)
4. [Supabase security checklist](https://supabase.com/docs/guides/security/production-checklist) — RLS on every table, email confirmation, test phone numbers (checked 2026-11-16)
5. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — email limits, CAPTCHA, rate limits (checked 2026-11-16)
6. [Firebase launch checklist](https://firebase.google.com/support/guides/launch-checklist) — rules, App Check, key restrictions, budget alerts (checked 2026-11-16)
7. [Tenzai: Bad Vibes](https://tenzai.com/blog/bad-vibes-comparing-the-secure-coding-capabilities-of-popular-coding-agents) — SSRF, CSRF, headers, rate limits, negative quantities (checked 2026-11-16)
8. [Vercel: v0 and vibe coding securely](https://vercel.com/blog/v0-vibe-coding-securely) — `NEXT_PUBLIC_` secrets, dev/prod, unauthenticated routes (checked 2026-11-16)
9. [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — features marked done without end-to-end testing (checked 2026-11-16)
10. [Lovable security docs](https://docs.lovable.dev/features/security.md) — quick scan and deep scan scope (checked 2026-11-16)
11. [Bolt: security audit on publish](https://bolt.new/blog/security-audit-on-publish) — audit scope (checked 2026-11-16)
12. [Replit: black-box pen tests](https://docs.replit.com/features/security/black-box-pen-tests.md) — anonymous plus synthetic users (checked 2026-11-16)
13. [Base44: running a security scan](https://docs.base44.com/Setting-up-your-app/running-a-security-scan) — scan scope, warns without blocking (checked 2026-11-16)
14. [Vals AI: Vibe Code Bench 1-100](https://vals.ai/benchmarks/vcb-1-100) — regressions and test data left in apps (checked 2026-11-16)
15. [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — client-rendered pages, soft 404s (checked 2026-11-16)
16. [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction) — the category names used in `security.md` (checked 2026-11-16)
