---
module: integrations-webhooks
kind: feature
title: Integrations and webhooks
checked: 2026-11-16
---
# Integrations and webhooks

Covers anything the product calls (third-party APIs: payments, email, maps, AI, storage, CRMs, OAuth providers) and anything that calls the product (incoming webhooks, callbacks, scheduled pulls). Focus: auth expiry, rate limits, retries and backoff, idempotency, signature verification, replay, ordering, timeouts, and failure handling. **Sandbox, test or mock accounts only.** Never hit a live third-party API with real data or hammer it to find limits. Goes with `payments-subscriptions.md`, `notifications.md`, `apis-backend.md`, `security.md` and `accounts-auth.md`.

## Signals

- SDKs and clients: `stripe`, `twilio`, `sendgrid`, `postmark`, `openai`, `@slack/web-api`, `octokit`, `googleapis`, `aws-sdk`, `axios`/`fetch` to external hosts.
- Webhook routes: `/webhooks/*`, `/api/stripe`, `/hooks`, signature headers (`Stripe-Signature`, `X-Hub-Signature-256`, `X-Slack-Signature`), queue workers, cron jobs polling APIs.
- `.env` keys for third-party services, OAuth client IDs, "Connect your <service>" buttons, Zapier or Make connectors, an outgoing-webhook settings page.
- README lists integrations.

## Kickoff questions

1. Which third parties does the product use, and does each have a sandbox or test mode I may use? (best guess: Stripe test mode, an email catcher, mocked AI)
2. Does the product receive webhooks, send them, or both? (best guess: from the routes found in the code)
3. Is it OK to run a local mock server in place of the real provider? (best guess: yes, preferred)

## Drivers

1. **Local mock servers and recorded fixtures.** Best default. WireMock, MockServer, `msw`, `nock`, `responses` (Python), `prism` (from an OpenAPI file), or a tiny script returning chosen status codes, delays and bodies. Point the product's base URL at it. Lets you inject 429, 500, timeouts, malformed JSON, duplicates and out-of-order events deterministically, with no third-party traffic.
2. **Provider test modes and CLIs.** Stripe test mode and `stripe listen` / `stripe trigger` / `stripe events resend`; GitHub's "redeliver" for webhooks; Slack test workspaces; Twilio test credentials; PayPal sandbox; Shopify development stores. Only with sandbox keys the user provides or the project already holds for testing.
3. **`curl` / scripted HTTP for incoming webhooks.** Sign a test payload yourself (HMAC-SHA256 with a test secret) and POST it to the local or staging endpoint; also send bad signatures, old timestamps, duplicates and reordered events.
4. **Email and SMS catchers.** Mailpit, MailHog, a provider's test inbox; see `notifications.md`.
5. **Request catchers you own.** `webhook.site`-style services should not receive real data; prefer a local listener for outgoing webhooks (`python -m http.server`, `nc -l`, a small Express app).
6. **Contract tests.** OpenAPI/JSON Schema validation against the provider's published schema (`schemathesis`, `dredd`) to catch drift.
7. **Logs and database inspection** in staging to prove the end state.

**Can't be driven here:** real live-mode behaviour of providers (rate-limit headers under real load, real card networks, real carrier delivery), provider outages, real OAuth consent screens for providers that forbid automation (a person completes those), and billing. Those are human or gate checks. Never load-test a provider.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Happy-path call to each integration (mocked or sandbox) and one valid signed webhook processed once |
| check | Smoke, plus failure injection (500, 429, timeout) on the changed integration |
| full | Integration × failure (401/expired token, 429, 5xx, timeout, malformed body, empty body, schema change) × webhook case (valid, bad signature, stale, duplicate, out-of-order, huge body) |
| release | Full against provider sandboxes, plus a human check of live-mode settings and secrets |

Dimensions: provider, direction (outbound call, inbound webhook, polling), failure type, auth type (API key, OAuth, signed request), environment (mock, sandbox, staging).

## Check catalogue

### Outbound calls: happy path and contract
- [high · agent] Exercise each integration in the main flow against the mock or sandbox → the end state is right (the order record, the email in the catcher, the CRM contact), not just a success toast {smoke}
- [high · auto] Validate requests the product sends against the provider's published schema or OpenAPI file → required fields present; correct API version header or pinned version
- [medium · auto] Validate the responses the product handles against fixtures, including fields it should ignore, new unknown fields and null values → no crash on extra or missing optional fields
- [medium · agent] API version pinning → the product pins a provider API version rather than "latest"; an upgrade path is documented
- [medium · agent] Base URLs and keys come from configuration, and the test build can't reach live endpoints → verified by network log
- [medium · agent] Request and response sizes, pagination and cursors → follow every page; no skipped or duplicated items at page boundaries

### Authentication and token expiry
- [high · agent] Mock a 401 and "token expired" mid-flow → the product refreshes the token once and retries, or asks the user to reconnect with a clear message; no infinite refresh loop; no data loss {smoke}
- [high · agent] OAuth: revoke the app's access on the provider's side (sandbox), then use the feature → a "reconnect" prompt, not a generic error; stored tokens are cleared or marked invalid
- [medium · agent] Refresh token rotation (new refresh token on each use) with two parallel requests → no race that burns the token and logs the user out
- [medium · agent] Key rotation: change the API key in config → the product picks it up without a redeploy bug or a leftover cached client; the old key is never logged
- [medium · agent] Wrong scopes or permissions (403) → a specific message about the missing permission, not a crash
- [high · auto] Keys and tokens → never in client code, logs, error messages or URLs (see `security.md`) {security}

### Rate limits and quotas
- [high · agent] Mock a 429 with `Retry-After` and with the common `X-RateLimit-*` headers → the product waits at least the stated time, retries, and doesn't hammer; the user sees "try again shortly" if the wait is long {smoke}
- [medium · agent] Burst: the product's own bulk actions (import 500 rows, send 100 emails) against a mock that rate-limits → the product queues, throttles or batches; no flood of failed calls; the job completes or reports partial results
- [medium · agent] Quota exhausted (daily or monthly limit) → a clear message to the user and an alert to the owner; no silent drops
- [medium · agent] Spend caps on metered APIs (AI, SMS, email, maps) → per-user or global limits exist and are tested with the mock {security}
- [low · agent] The product reads rate-limit headers rather than guessing

### Retries, backoff, timeouts and failure
- [high · agent] Mock a 500, 502, 503 and a connection reset → retried with exponential backoff and jitter, a small maximum number of attempts, then a clear failure; no tight retry loop {smoke}
- [high · agent] Do not retry non-retryable errors (400, 401 after refresh, 403, 404, 422) → no retries; the error is surfaced
- [high · agent] Mock a slow response (30 s, then never) → a timeout fires within the product's setting (every outbound call has one); the UI shows a message and stays usable; no thread, request or screen is blocked forever
- [medium · agent] Timeout where the provider actually succeeded (the response was lost) → the product doesn't charge or create twice on retry (see idempotency)
- [medium · agent] Malformed, empty, HTML (not JSON) and truncated responses; wrong content-type → handled; no unhandled exception; the raw body isn't shown to users
- [medium · agent] Provider fully down for 10 minutes (mock returns 503) → the app degrades gracefully: queues work, shows a status, or disables the feature; recovers without a restart; circuit-breaker behaviour where claimed
- [medium · agent] DNS failure and TLS error → handled; certificate errors are never ignored in production config {security}
- [medium · agent] Fallbacks and partial failure (the email provider is down but the order succeeded) → the main action isn't rolled back needlessly; the failed side effect is retried from a queue or reported

### Idempotency and duplicates
- [high · agent] Outbound writes that create money or records (charges, orders, emails, SMS): double-click, retry after timeout, and repeated job runs → one effect only; an idempotency key is sent where the provider supports one (for example Stripe's `Idempotency-Key`) and is stable across retries {smoke}
- [high · agent] Inbound webhooks: deliver the same event (same ID) 3 times → processed once; later copies return success quickly with no side effect; events are stored by ID
- [medium · agent] Jobs and queue consumers: kill a worker mid-job and restart → the job completes once; no duplicate side effects (at-least-once delivery assumed)
- [medium · agent] Create-then-update races: two requests with the same idempotency key but different bodies → rejected clearly

### Webhooks: signatures, replay and ordering (incoming)
- [high · auto] Send a payload with a valid signature (HMAC with the test secret, on the raw body) → accepted with 2xx {smoke} {security}
- [high · auto] Send the same payload with a bad, missing or truncated signature → rejected (400 or 401) before any processing {security}
- [high · auto] Modify one byte of the body but keep the old signature → rejected {security}
- [high · auto] Replay a valid old request (timestamp older than the tolerance, for example 5 minutes where the provider signs a timestamp) → rejected; where there's no timestamp, the event ID is deduplicated {security}
- [medium · auto] Signature compared with a constant-time function, computed on the raw body (not re-serialised JSON), with the secret from config → true when the code is visible {security}
- [high · agent] Out-of-order events (an "updated" arriving before "created", "refunded" before "paid", a subscription "deleted" then "updated") → the end state is right; the product uses timestamps, versions or re-fetches current state instead of trusting arrival order
- [medium · agent] Events for unknown or deleted objects → ignored with 2xx or queued; no crash and no endless retries from the provider
- [medium · agent] Unknown event types and new fields → ignored gracefully, still 2xx
- [medium · agent] Slow processing: the endpoint returns 2xx quickly (provider timeouts are often seconds) and does heavy work in a queue → verified by timing a heavy event
- [medium · agent] Handler failure (500) → the provider retries; the product processes the retry once; a failing event doesn't block the queue
- [medium · agent] Huge body, wrong method, wrong content type, and gzip bodies → rejected or handled with limits; no memory blow-up {security}
- [medium · agent] Webhook endpoint is not discoverable as an admin or user API and doesn't use cookie auth → CSRF doesn't apply; only the signature protects it {security}
- [low · agent] Multiple signing secrets during rotation (old and new both valid for a window) → both accepted for the window, then only the new one

### Outgoing webhooks (the product calls its customers)
- [high · agent] Event fires → payload sent to the registered URL with a signature header, event ID, timestamp and a stable schema; verified at a local listener you run {smoke}
- [medium · agent] Customer endpoint returns 500 or times out → retried with backoff for a stated period, then marked failed and visible in the UI or logs
- [medium · agent] Registered URL points at internal addresses or metadata endpoints → refused (SSRF; see `security.md`) {security}
- [medium · agent] Disable, delete or rotate the secret of a webhook → deliveries stop or use the new secret
- [low · agent] Delivery log and manual redeliver → exist where claimed

### Polling, sync jobs and scheduled pulls
- [medium · agent] Scheduled pull runs twice at once (overlapping) → one run holds a lock; no duplicate records
- [medium · agent] Last-sync cursor and deleted items → deletions at the source are reflected; the cursor survives a restart
- [medium · agent] Clock skew and timezone in sync windows → no gaps or double-counted items at the boundary
- [medium · agent] Partial failure halfway through a sync → resumes from the right place; reports what failed

### Data mapping, privacy and user-facing behaviour
- [medium · agent] Field mapping between the product and the provider (names, currencies, decimals, time zones, character encodings, emoji) → round-trips without loss or mangling
- [medium · agent] Data sent to providers → matches the privacy policy; no personal data in IDs, URLs or metadata that isn't needed (see `privacy-consent.md`)
- [medium · agent] Status page and error messages for users when a provider fails → say what failed and what to do; don't blame the user or leak provider internals
- [low · agent] Disconnect an integration → tokens deleted, scheduled jobs stop, and imported data is kept or removed as the product says

## Gates

- Payment providers: live mode, webhooks registered with live secrets, and one real low-value purchase and refund are human-only; see `payments-subscriptions.md` and the web launch gate.
- OAuth app review and scopes approval for Google, Meta, Slack and others are external gates handled by the user.

## Human-only checks

- [human] Complete the real OAuth consent flow with a test account for each provider that blocks automation → the product connects and shows the right account.
- [human] Check live-mode keys, webhook endpoints and secrets in the provider dashboards → live endpoints registered, secrets stored only in the host's secret store, test and live separated.
- [human] Confirm billing alerts and quotas on every metered provider → set, and reach the owner.
- [human] Decide how the product should behave when a provider is down for hours → acceptable fallback.

## Known pitfalls

- **Providers retry on their own schedule.** A duplicate delivery isn't a provider bug; the receiver must handle it.
- **Sandbox behaviour differs from live.** Sandbox data, limits and timing are simplified; record "tested in sandbox only".
- **Signature checks fail on re-serialised JSON.** Use the raw body; a failing test with pretty-printed JSON is a test bug.
- **Test clocks.** Timestamp tolerance tests depend on the machine clock; fix the clock instead of sleeping.
- **429 from a mock you wrote isn't the provider's behaviour.** Match real headers from the provider's docs.
- **Don't discover limits by hammering.** Read the docs; test the product's reaction with a mock.
- **Webhook URLs on localhost** need a tunnel for real providers; use the provider's CLI or a mock instead, and never expose a dev machine to the internet casually.
- **A 200 from the webhook endpoint doesn't mean it processed the event.** Check the end state.

## Sources

1. [Stripe: Webhooks (signatures, retries, idempotency)](https://docs.stripe.com/webhooks) — signature verification with the raw body, replay tolerance, duplicate events, retries (checked 2026-11-16)
2. [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) — idempotency keys (checked 2026-11-16)
3. [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live) — webhooks tolerate delays, duplicates and any order; sandbox objects don't work live (checked 2026-11-16)
4. [GitHub: Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) — HMAC-SHA256 header and constant-time compare (checked 2026-11-16)
5. [RFC 9110: Retry-After and status codes](https://www.rfc-editor.org/rfc/rfc9110) — `Retry-After`, 429 handling basis (checked 2026-11-16)
6. [OWASP API Security Top 10 2023](https://owasp.org/API-Security/) — unsafe consumption of APIs, resource consumption, SSRF (checked 2026-11-16)
