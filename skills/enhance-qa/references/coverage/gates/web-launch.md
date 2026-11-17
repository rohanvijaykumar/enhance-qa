---
module: web-launch
kind: gate
title: Web launch gate (14 checks, run against the deployed URL)
checked: 2026-11-16
---
# Web launch gate (14 checks, run against the deployed URL)

The launch gate for any web app or site going live, especially apps built mostly by AI agents. It runs against the deployed production or production-like URL, not localhost, because most launch incidents are configuration and environment mistakes that only appear there. The checks are numbered L1 to L14 in the order of research note 11, section 4.3. Production is read-only for agents: use a test account, test mode and a staging copy for anything that writes. Anything with outside effects (real payment, real email to real people, billing settings) is a human step. Use with `../platforms/web-app.md`, `../features/ai-built-app-risks.md`, `../features/security.md`, `../features/accounts-auth.md`, `../features/payments-subscriptions.md`, `../features/accessibility.md`, `../features/performance.md`, `../features/privacy-consent.md`, `privacy-law.md` and `accessibility-law.md`.

## Signals

- A web app or site with a production URL, or a `release` pass whose plan names a deploy target (Vercel, Netlify, Cloudflare, Fly, Render, Supabase, Firebase, own server).
- The plan names "launch", "go live" or "production".
- The product was built mainly by an AI agent or a no-code or AI app builder (the risks are higher; run all 14 and treat L1 to L3 as always on).

## Kickoff questions

1. What is the production URL, and is there a staging copy and a test account that is safe to use? (best guess: ask for both; if there's no staging copy, agents stay read-only on production)
2. Which services are used: database and auth (Supabase, Firebase, own), payments (Stripe), email (SMTP provider), LLM APIs, analytics? (best guess: read the repo and the deployed bundle)
3. Who receives alerts, and can you read the test inbox? (best guess: the founder; ask for a test inbox address)

## Drivers

1. **HTTP and DNS probes.** `curl -sI`, `curl` for raw HTML, `dig`/`nslookup` for SPF, DKIM and DMARC records, `openssl s_client` for TLS. Read-only, exact, cheap.
2. **Bundle and repo scans.** Fetch the deployed JS and source maps, then grep for key patterns; run a secret scanner (gitleaks, trufflehog) on the repo and its history. Read-only.
3. **Playwright against the URL** with the test account: sign-up, login, reset, logout, core flow, 375 px viewport, throttled network, forced API errors. Use scoped accessibility trees; screenshots only for visual checks at 1280×800 or less. Act on a batch of steps, then observe once.
4. **Cross-user probes with the app's own public key.** Using two test users, try to read and write the other's rows and files through the real client or API. Test data only; never real customers' data.
5. **Lighthouse, axe-core, Core Web Vitals tools** for L11, L13 and L14.
6. **Platform dashboards** (database advisor, billing, backups, monitoring). Need the user's login. Agents never type credentials; the human reads or pastes results.

**Can't be driven here:** real payments and refunds, real inbox delivery to a person's mailbox, billing and spend-cap settings, backup restore on production, and judging legal text. These are human checks. No load tests or abuse of third-party services: probe rate limits with a small, bounded number of requests on staging only.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | L1, L2, L3 (the always-on core) |
| check | L1 to L3, plus any check whose area changed |
| full | L1 to L14 against the deployed URL, test accounts and test mode |
| release | full, plus every human line (live payment test, restore drill, legal read, alert test) |

Dimensions: desktop and 375 px mobile, logged out versus two test users, Chrome plus one other browser, test mode versus live mode.

## Check catalogue

### L1 Data access
- [high · agent] With no login, call every table, view, bucket, RPC, edge function and API route the app uses (list them from the code and the deployed bundle) → reads and writes are refused; no row, file or listing comes back {smoke}{security}
- [high · agent] Log in as test user A, then read, update and delete test user B's rows and files by ID through the real client → refused every time; no data leaks in error messages {security}
- [high · agent] Check access is enforced on the server side (row-level security, rules, or API checks), not only hidden in the UI → direct API calls get the same answer as the UI {security}
- [medium · agent] Check admin routes and service-role endpoints with a normal user's session → refused
- [high · human] Read the platform's security advisor or rules report (database, storage, Firebase rules) → clean, or every warning has a written reason. Note: new tables in some platforms are private by default and need explicit grants, so test every new table through the real client (see Sources 1)

### L2 Secrets
- [high · auto] Fetch the production JS bundles and source maps and grep for key patterns (service-role keys, LLM keys, payment secret keys, private URLs, tokens) → none; publishable and anon keys are allowed only where designed for the browser {smoke}{security}
- [high · auto] Run gitleaks or trufflehog over the repo and its full history, and over build logs → no live secret; any found is rotated, not only deleted
- [medium · human] Keys used during development (and any pasted into AI chats) are rotated before launch → human confirms rotation
- [medium · auto] Check public responses, error pages and headers for stack traces, internal hostnames or tokens → none {security}

### L3 Auth end to end in production
- [high · agent] On production with a test inbox: sign up, receive the confirmation email, click it, log in, reset password, receive the reset email, log in with the new password, log out → every step works and the emails arrive {smoke}
- [high · agent] Confirm email verification is on (an unconfirmed account can't use the app) → refused until confirmed
- [high · agent] OAuth login with a test account from the production domain → redirect URIs and production origin are allowed; no "redirect_uri mismatch"
- [medium · agent] Session after logout, after password change and after expiry → old session refused; cookies are Secure and HttpOnly {security}
- [medium · human] Inbox access to read real delivery, spam placement and the link text → emails arrive in the inbox, not spam, and links point to the production domain (not localhost)

### L4 Abuse and cost controls
- [high · agent] On staging only, send a small bounded burst to login, sign-up, reset and the costliest endpoints (including LLM calls) → rate limiting or lockout kicks in; never run this against production or third-party services at scale {security}
- [medium · agent] Check CAPTCHA or bot protection on sign-up and contact forms → present and verifies server-side
- [high · human] Billing dashboards of every metered service (hosting, database, LLM, email, storage) have budget alerts or hard spend caps → human reads and confirms the settings
- [medium · agent] Check LLM endpoints need login and have per-user limits and max input size → anonymous callers can't spend the owner's money

### L5 Payments live
- [high · agent] In test mode: checkout, success, failure, cancel and refund with the provider's test cards; replay the same webhook twice and out of order → entitlement granted once; no double charge or double credit
- [high · auto] Live keys are set only in production, live webhook endpoints are registered and verify signatures, and live products and prices exist → test keys aren't in production, and live ones aren't in the repo
- [medium · agent] Refund policy, terms, contact and receipts are present and linked at checkout → all reachable
- [high · human] One real low-value purchase and refund, done by the account owner, with their own card → the order, receipt, entitlement and refund all work. Agents never use real cards or live payments
- [medium · human] Tax, invoicing and payout settings are set up with the provider → human confirms

### L6 Prod versus dev separation
- [high · auto] Production uses its own database, storage, auth project and keys, not the development ones → connection strings and project IDs differ
- [high · agent] Search the deployed pages for "lorem ipsum", "TODO", "test", placeholder text, dummy data, `localhost` URLs, debug flags and verbose errors → none
- [medium · auto] Check environment variables are set in production and no `.env` file or example key is deployed → complete and clean
- [medium · agent] Trigger a 404, a 500 and a bad input → friendly errors with no stack trace
- [medium · human] Source maps policy: decided and written (public or not) → decision recorded

### L7 Backups and restore
- [high · human] Read the backup settings for the plan in use: automatic backups exist, last backup date is known, and storage files are covered or the gap is accepted (some free plans have no backups) → written down
- [high · human] Restore drill: restore the latest backup into a separate project and open the app against it → data returns, or the risk is explicitly accepted in the plan. Agents never restore into production

### L8 Monitoring
- [high · agent] Trigger a deliberate test error on staging or a safe test route → it appears in the error tracker with a useful stack trace
- [medium · agent] An uptime or synthetic check runs the core flow (not just the home page) → check exists and passes
- [high · human] Alerts reach a human (email, chat, phone) and the human confirms receipt of a test alert → alert received

### L9 Email deliverability
- [high · auto] `dig TXT` for the sending domain: SPF record exists and includes the provider; DKIM selector resolves; DMARC record exists at `_dmarc` with a policy → all three present and aligned (see Sources 2)
- [high · agent] Send a test email through production SMTP to a test inbox and read the headers → SPF, DKIM and DMARC show pass; From domain aligns
- [medium · agent] Check the app uses a custom SMTP service and not the platform's built-in limited email → volume and sender are right
- [medium · agent] Marketing or bulk mail has a working unsubscribe link and one-click header → present (large senders need this) (see Sources 2)

### L10 Legal pages
- [high · agent] Privacy policy, terms, refund or cancellation policy and contact page exist, are linked in the footer, and aren't placeholders → each loads with real text
- [high · agent] If analytics or ad cookies are used for visitors in the EU or UK, consent is asked first and refusal stops them; see `privacy-law.md` → no analytics requests before consent
- [high · human] Read the policies against what the product really does → matches (data collected, processors, retention, contact). Not legal advice: a lawyer reviews if the risk is high

### L11 SEO and sharing
- [medium · auto] Fetch raw HTML with `curl` (no JavaScript) for each main route → unique `<title>`, meta description, canonical and Open Graph tags are present in the raw HTML
- [medium · auto] `/sitemap.xml` and `/robots.txt` exist and don't block the whole site by mistake → valid and right
- [medium · auto] An unknown URL returns HTTP 404, not 200 with the home page → real 404
- [medium · agent] Share the URL in a link-preview tester → right image, title and description
- [low · agent] Analytics fires after consent → one pageview event after consent, none before

### L12 UX basics on core flows
- [high · agent] At 375 px wide, do the core flows → no horizontal scroll, readable text, tap targets usable
- [medium · agent] Throttle to a slow network and run the core flow → loading states, no double submit
- [medium · agent] Use a brand-new empty account → helpful empty states, no broken screens
- [medium · agent] Force an API failure (block a request) on each core flow → clear error and recovery
- [medium · agent] Check native dialogs, file pickers, date inputs and back-button behaviour → work

### L13 Accessibility smoke
- [high · auto] Run axe-core or Lighthouse accessibility on the landing and core pages → no critical or serious violations (automated tools find only part of the problems) {a11y}
- [high · agent] Do the core flow with the keyboard only → every control is reachable and visible when focused; no keyboard trap {a11y}
- [medium · agent] Images have meaningful alt text and form fields have labels → pass {a11y}
- [medium · human] See `../features/accessibility.md` for the full checks and `accessibility-law.md` for legal duties

### L14 Performance smoke
- [medium · auto] Lighthouse or field Core Web Vitals on the landing and core page → LCP at or under 2.5 s and CLS at or under 0.1 in the lab; INP is a field metric (lab tools use Total Blocking Time) (see Sources 3)
- [medium · agent] Look for slow queries, huge images and large bundles on the core flow → none obvious; list the worst offenders
- [low · auto] Check caching headers and compression on static assets → set

## Gates

L1, L2 and L3 must pass before any launch. L5 (live purchase and refund by the owner), L7 and L10 need a human sign-off. Any open high-risk line is either fixed or explicitly accepted by the owner in the plan.

## Human-only checks

- [human] Make one real low-value purchase with your own card and refund it. Judge: receipt, access and refund all arrive.
- [human] Open the test inbox and read the sign-up and reset emails. Judge: arrive fast, not in spam, links go to the real site.
- [human] Read the billing and backup settings pages of each service. Judge: caps and backups are what you meant.
- [human] Read the privacy policy and terms like a visitor.
- [human] Receive a test alert on your phone or chat.

## Known pitfalls

- "Anon key found in the bundle" is not a finding by itself; browser keys are meant to be public. The finding is reading data with it.
- Don't test production with destructive or high-volume requests. Use staging and a bounded handful of requests.
- A staging site behind a password or without real DNS can't prove email deliverability or OAuth domains; test on the real domain.
- Lighthouse scores vary run to run. Use the median of several runs and field data when you have it.
- Platform defaults change (for example database grants and privacy defaults). Re-check the platform's current docs and note the date.
- Link previews and search crawlers cache old pages. A stale preview isn't always a bug.
- Legal pages are a presence check for agents. The wording is a human or lawyer matter.

## Sources

1. Research note 11, section 4.3 (the launch gate) and the Supabase changelog on tables not exposed to the Data API by default: [changelog 28 Apr 2026](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) (checked 2026-11-16 via research note 11; not re-fetched this pass)
2. [Google email sender guidelines](https://support.google.com/a/answer/81126) — SPF, DKIM, DMARC and one-click unsubscribe for bulk senders (not re-fetched this pass)
3. [Web Vitals](https://web.dev/articles/vitals) — LCP, INP and CLS thresholds (checked 2026-11-16 via research note 2)
4. [GDPR Article 13](https://gdpr-info.eu/art-13-gdpr/) — information at collection (checked 2026-11-16 via research note 11)
