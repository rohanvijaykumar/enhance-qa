---
module: apis-backend
kind: platform
title: APIs and backend services
checked: 2026-11-16
---
# APIs and backend services

Covers REST, GraphQL and gRPC APIs, webhooks (both sending and receiving), and background jobs and queues. It covers status codes, validation, auth and authorisation per endpoint, pagination, idempotency, rate limits, versioning, error format, timeouts and retries, concurrency and contract tests. It doesn't cover the web or mobile client (use their modules), or deep security testing (use `../features/security.md`). It usually goes with `../features/accounts-auth.md`, `../features/integrations-webhooks.md`, `../features/payments-subscriptions.md`, `../features/data-import-export.md` and `../features/performance.md`.

## Signals

- An OpenAPI or Swagger file (`openapi.yaml`, `swagger.json`), a GraphQL schema (`schema.graphql`, `*.gql`), `.proto` files, Postman or Bruno collections, `.http` files.
- Frameworks: Express, Fastify, NestJS, Hono, FastAPI, Flask, Django REST, Rails, Spring, ASP.NET, Gin, Fiber, Laravel; Cloudflare Workers or Lambda handlers; queue libraries (BullMQ, Celery, Sidekiq, SQS, RabbitMQ, Kafka clients).
- Routes folders (`routes/`, `controllers/`, `api/`, `app/api`), webhook handlers, cron or worker entry points.
- README words: "API", "endpoint", "webhook", "worker", "queue".

## Kickoff questions

1. Which API styles and which environment can we call (local, staging, never production writes)? (best guess: local dev server with a seeded test database)
2. How does auth work, and are there test users for each role and each tenant? (best guess: bearer tokens or session cookies from the seed script)
3. Is there an OpenAPI or schema file that is meant to be the contract, and who are the API's clients? (best guess: yes if a spec file exists; its own web client otherwise)

## Drivers

1. **curl, HTTPie or Bruno and `.http` files.** The cheapest deterministic driver for single requests. Print status, selected headers and the body with `curl -sS -D - -o body.json`, `curl -w '%{http_code} %{time_total}\n'`, or `http --print=hb`. Keep output short with `jq` filters and exit-code checks.
2. **Scripts and test runners.** A short script (bash, Node, Python `requests` and `pytest`, `supertest`, `httpx`) for multi-step flows, ordered data setup and parallel calls. Better than clicking through a tool for anything over three requests.
3. **Contract and property-based testing.** Schemathesis from an OpenAPI or GraphQL schema finds 5xx errors and responses that break the schema, runs negative cases and chains calls; Dredd, Prism (mock and validate), `spectral lint` for the spec and `openapi-diff` for breaking changes [1][2]. Point them at a local or staging server only.
4. **Protocol tools.** `grpcurl` (gRPC reflection or `.proto`), `grpc-health-probe`, GraphQL clients (curl with a JSON body, Altair, `graphql-inspector`), `websocat` for WebSockets, `openssl s_client` for TLS.
5. **Webhook helpers.** A local receiver (a small script or `webhook.site`-style tool with fake data only), the provider's CLI in test mode (for example `stripe listen` and `stripe trigger`), and signed test payloads built with the shared secret from the test environment [3].
6. **Queue and job tools.** The queue's own admin CLI or dashboard (Bull Board, Flower, `rabbitmqctl`, `aws sqs` against a local emulator such as LocalStack, `kafka-console-consumer`), run against local or test queues only.
7. **Logs, traces and the database.** Application logs, request ids, `docker compose logs`, read-only SQL queries against the test database to confirm end state (not only the response).
8. **Light load tools** (`hey`, `wrk`, `k6`, `ab`) only against a local server for a small burst. No load testing of staging or production, and no load on third-party services.

**Can't be driven here:** real production load shapes, real third-party integrations that need live credentials, real payment and email delivery, and business-rule correctness without a spec (human). Multi-region, failover and scale behaviour need the user's environment. Pen-test-level security work is out of scope for agents; use the security pack for basics.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | local server with seeded data; health check, one authenticated read, one create and read-back |
| check | smoke, plus the changed endpoints with valid, invalid, unauthenticated and wrong-role requests |
| full | every endpoint × (valid, invalid, no auth, wrong role, other tenant) plus pagination, idempotency, rate-limit and error-format sweeps |
| release | full against staging, contract suite and breaking-change diff against the last release, migration rehearsal on production-like data, human review of business rules |

Dimensions: endpoint and method; role (anonymous, user, admin, service); tenant or owner; API version; payload (valid, boundary, invalid, huge, malformed); content type and `Accept`; client (own web app, SDK, curl); data volume; dependency state (database down, third party slow); feature flags; time and time zone.

## Check catalogue

### Smoke
- [high · auto] Start the service from a clean state and call the health or root endpoint → HTTP 200 and the expected body; no errors in the log {smoke}
- [high · agent] Authenticate with a test user, create one resource, read it back, list it, delete it → each call returns the right status and the data matches in the database {smoke}
- [high · auto] Run the project's tests, linter and `spectral lint` (or schema validation) on the spec → pass, or failures recorded as baseline {smoke}

### Status codes, methods and headers
- [high · auto] For each endpoint, send each supported method and one unsupported method → supported ones behave as documented; unsupported returns 405 with an `Allow` header [4]
- [high · auto] Check success codes → 200 for read, 201 with `Location` for create, 204 for empty success, 202 for accepted async work; never 200 with an error in the body
- [high · auto] Check error codes → 400 for malformed, 401 for no or bad credentials, 403 for authenticated but not allowed, 404 for missing, 409 for conflicts, 415 for wrong content type, 422 for semantic validation, 429 for rate limit; never 500 for a client mistake [4]
- [medium · auto] `Content-Type` and `Accept` negotiation: send JSON, form data, XML, wrong and missing types; ask for an unsupported type → 415 or 406 with a clear message; responses carry the correct `Content-Type` and charset
- [medium · auto] CORS: preflight (`OPTIONS`) from an allowed origin, a disallowed origin and `null` → only intended origins and methods allowed; credentials not combined with `*` {security}
- [medium · auto] Security headers and caching headers on responses (`Cache-Control: no-store` on private data, `X-Content-Type-Options`, no `Server` version leak) → present and sensible {security}
- [medium · auto] HEAD, OPTIONS and trailing-slash variants, URL case, double slashes, encoded characters in paths → consistent behaviour; no 500

### Input validation
- [high · auto] Send each required field missing, null, empty, wrong type (string for number, array for object), too long, negative, zero, and max+1 → 400 or 422 naming the field; nothing saved
- [high · auto] Send unknown extra fields and fields the caller must not set (`id`, `role`, `isAdmin`, `ownerId`, `price`) → ignored or rejected; never applied (mass assignment) {security}
- [high · auto] Malformed JSON, truncated body, wrong encoding, duplicated keys, deeply nested JSON, a very large body → 400 or 413; fast rejection; no crash or hang
- [medium · auto] Strings with Unicode, emoji, null bytes, very long text, leading and trailing spaces, SQL and NoSQL operators (`' OR 1=1 --`, `{"$ne": null}`), HTML and shell metacharacters → stored and returned as plain data; no query or command injection {security}
- [medium · auto] Dates and times (ISO 8601, time zones, leap day, 24:00, past and future), numbers (float rounding, big integers beyond 2^53, currency with cents), and enums → parsed or rejected consistently; no silent rounding or time-zone shift
- [medium · auto] Query parameters: repeated, empty, array syntax, unknown, huge → documented behaviour; unknown ones ignored or rejected as the docs say
- [medium · auto] File and multipart uploads: wrong type, zero bytes, over the size limit, double extension → rejected with 400 or 413; content type checked from content, not only from the name {security}
- [medium · auto] Validation messages and error body → say which field and why; don't leak internals, SQL, stack traces or file paths {security}

### Authentication and authorisation (per endpoint)
- [high · auto] Call every endpoint with no credentials, an expired token, a malformed token, a token for another environment, and a revoked token → 401 each time (except public endpoints); no data in the body {security}
- [high · auto] Call every endpoint as each role (user, admin, service, read-only) → allowed or 403 exactly as the permission table says; build the role × endpoint grid and diff it with the docs {security}
- [high · auto] Object-level access: as user A request user B's resource by id (GET, PUT, PATCH, DELETE), and by guessing sequential ids → 403 or 404; never B's data (BOLA, the top API risk) [5] {security}
- [high · auto] Function-level access: as a normal user call admin or internal endpoints, bulk and export endpoints → 403 {security} [5]
- [high · auto] Field-level access: read and write fields a role must not see or change (other users' emails, internal flags, price) → hidden or rejected {security} [5]
- [high · auto] Tenant isolation: request, list, search, export and count across tenants with a tenant A token and tenant B ids and filters → only A's data appears anywhere, including counts and error text {security}
- [high · auto] Token handling: lifetime, refresh, logout and revoke, password change → old tokens stop working as documented; tokens aren't accepted in the query string logs; JWT `alg: none` and wrong-signature tokens rejected {security}
- [medium · auto] Brute force on login and token endpoints at a small test rate (a handful of attempts) → throttling or lockout appears as documented; messages don't reveal whether the account exists {security}
- [medium · auto] API keys and secrets: in URLs, logs, error messages and responses → never; keys scoped and revocable {security}
- [medium · auto] SSRF-prone endpoints (URL fetch, webhooks to user-set URLs, image import) → internal addresses (`localhost`, `169.254.169.254`, private ranges) are refused {security}

### Pagination, filtering and sorting
- [high · auto] List endpoints: first page, middle, last, past the end, page size 0, 1, max, max+1, negative → documented behaviour; stable total or next-link; a clear error on invalid values; a default and a max limit exist
- [high · auto] Insert and delete rows between page requests → cursor pagination doesn't repeat or skip rows; offset pagination limits are documented
- [medium · auto] Sort by each documented field, ascending and descending, with ties → stable, deterministic order (secondary key by id); unknown sort field returns 400
- [medium · auto] Filters: each filter alone, combined, empty result, invalid value, injection-like value → correct results; counts match
- [medium · auto] Large collections (10,000+ rows) → response time and size bounded; no unbounded list returned by default

### Idempotency, retries and concurrency
- [high · auto] Send the same POST twice with the same idempotency key → the second returns the original result, no second record; same key with a different payload returns an error (the IETF Idempotency-Key draft suggests 422); in-flight duplicate gives 409 (draft behaviour, still an Internet-Draft, not a standard) [6]
- [high · auto] Repeat PUT and DELETE → PUT leaves the same state; DELETE twice returns 204 or 404 as documented, never 500
- [high · auto] Fire 10 to 20 identical create requests in parallel against a local server → exactly one created where uniqueness is promised; no duplicate rows, no deadlock errors
- [high · auto] Two clients update the same resource using `ETag` and `If-Match` (or a version field) → the second gets 412 or 409 and doesn't overwrite silently (lost update) [4]
- [medium · auto] Counters, balances and stock under parallel requests (local only) → totals correct; no negative stock or double spend
- [medium · auto] Interrupt a request (client disconnect mid-call) → the server finishes or rolls back cleanly; no half-written state
- [medium · auto] Check which methods are safe to retry → GET and idempotent methods can be retried by clients; POST without a key warns in the docs

### Rate limits, timeouts and resilience
- [high · auto] Exceed the documented rate limit in a small local burst → 429 with `Retry-After` (and rate limit headers if documented); after waiting, requests succeed [4]
- [medium · auto] Slow client, slow upstream and slow database (inject delay with a proxy such as toxiproxy or a stub) → the server times out with 504 or 503 and a clear body in the documented time; no thread or connection leak
- [medium · auto] Dependency down (stop the database, cache, queue or a third-party stub) → 503 with a clear message, health endpoint reports it, recovery without restart when the dependency returns
- [medium · auto] Retry logic in the service's own outbound calls → bounded retries with backoff and jitter; no retry storms; no retry of non-idempotent calls without a key
- [medium · auto] Large and slow requests (big body, big response, streaming) → limits enforced; memory flat; streaming works with a client that reads slowly
- [medium · auto] Graceful shutdown (SIGTERM) during in-flight requests and jobs → they finish or are returned to the queue; no dropped work
- [low · auto] Health, readiness and liveness endpoints → separate; readiness fails when a hard dependency is down; don't expose internals publicly

### Error format and logging
- [high · auto] Trigger every error class → one consistent error shape (for example RFC 9457 problem details: type, title, status, detail) with a stable machine-readable code; the status in the body matches the HTTP status [7]
- [high · auto] Trigger a 500 on purpose (a local fault) → generic message plus a request id; no stack trace, SQL, file path, environment variable or secret in the response {security}
- [medium · auto] Error messages for validation, auth and not found → helpful but not leaking (the same message for unknown user and wrong password)
- [medium · auto] Logs for each request → include request id, status and timing; no tokens, passwords, card numbers or personal data {security}
- [medium · auto] A request id or trace id header → returned on responses and carried to logs and downstream calls

### Versioning and contract
- [high · auto] Validate responses against the OpenAPI or GraphQL schema with Schemathesis or a validator → no schema violations; no 5xx from generated inputs [1]
- [high · auto] Diff the spec against the last release (`openapi-diff`, `graphql-inspector diff`, `buf breaking` for protobuf) → no breaking changes (removed fields, changed types, new required inputs) without a new version
- [medium · auto] Call old and new API versions (path, header or media type) side by side → old clients keep working; deprecation is signalled (`Deprecation` and `Sunset` headers or docs)
- [medium · auto] The spec's examples → every example request in the docs runs and returns the documented response
- [medium · auto] Backward compatibility of data shapes: unknown enum values, new optional fields, null vs missing → older clients don't crash (tolerant reader)
- [medium · agent] Check each endpoint is in the spec and each spec endpoint exists → no undocumented ("shadow") endpoints; no documented ones that return 404 {security}

### GraphQL specifics
- [high · auto] Introspection and schema exposure in production config → disabled or intentionally public; no internal types exposed {security}
- [high · auto] Deeply nested and circular queries, huge aliases and batched queries → rejected by depth, complexity or size limits; the server stays responsive {security}
- [high · auto] Field-level authorisation: query fields of other users through nested relations → denied; resolvers apply the same access rules as REST
- [medium · auto] N+1 queries on list resolvers (count SQL statements for one request) → batched (dataloader); statement count doesn't grow with list size
- [medium · auto] Errors: partial data with `errors` array, validation errors, auth errors → the response shape follows the GraphQL spec; HTTP status is as documented (often 200 with `errors`) [8]
- [medium · auto] Mutations: invalid input, repeated submit, concurrent update → consistent errors and no duplicates; subscriptions authenticate and clean up on disconnect

### gRPC specifics
- [high · auto] Call each method with `grpcurl` for valid input, missing and invalid fields, and no auth metadata → correct gRPC status codes (INVALID_ARGUMENT, UNAUTHENTICATED, PERMISSION_DENIED, NOT_FOUND, ALREADY_EXISTS, DEADLINE_EXCEEDED) [9]
- [medium · auto] Deadlines and cancellation: client sets a short deadline, or cancels mid-call → the server stops work and returns DEADLINE_EXCEEDED or CANCELLED; no leaked work
- [medium · auto] Streaming methods: slow consumer, early cancel, server error mid-stream → the stream ends cleanly with a status; backpressure respected
- [medium · auto] Reflection and health service in production → reflection off unless intended; the health service reports correctly
- [medium · auto] `buf lint` and `buf breaking` on `.proto` files → no breaking field number or type changes

### Webhooks (sending and receiving)
- [high · auto] Receiving: send a signed test payload, a payload with a wrong signature, a missing signature, a stale timestamp and a replayed event id → only the valid fresh one is processed; others are rejected with 400 or 401 and logged {security} [3]
- [high · auto] Receiving: the same event delivered twice, and events out of order → processed once (dedupe by event id); state ends correct
- [high · auto] Receiving: respond quickly (2xx) and do heavy work in a queue; endpoint returns 5xx on temporary failure → provider retries are handled; no long blocking handler
- [medium · auto] Receiving: raw body handling → signature checked on the raw bytes, before JSON parsing and before any middleware changes the body
- [medium · auto] Sending: trigger an event with a test receiver that returns 200, 500, a timeout and 410 → retried with backoff on failure, stops after the documented limit, is disabled or flagged on repeated failure
- [medium · auto] Sending: payload contains the event id, type, timestamp and a signature; the secret can be rotated → receivers can verify; both secrets work during rotation
- [medium · auto] Sending: user-supplied webhook URLs → only HTTPS (or allowed schemes); private and internal addresses refused (SSRF); redirects not followed blindly {security}
- [medium · auto] Delivery log or dashboard if present → shows attempts, status and a manual replay that doesn't duplicate side effects

### Background jobs and queues
- [high · auto] Enqueue a job and watch it run (test queue, local worker) → runs once, result and side effects correct, status visible
- [high · auto] Make a job fail (throw, time out, kill the worker mid-job) → retried with backoff up to the limit, then dead-lettered; no infinite retry; no lost job
- [high · auto] Enqueue the same job twice and replay a delivered message (at-least-once delivery) → handlers are idempotent; no double emails, charges or records (use sandboxes and fake senders)
- [medium · auto] Order and concurrency: many jobs for one user or entity → ordering rules hold where promised; locks prevent two workers doing the same job
- [medium · auto] Scheduled jobs (cron): run at the right time, in the right time zone, once across multiple instances; daylight-saving shifts handled → one run per schedule
- [medium · auto] Poison messages (invalid payload, huge payload) → rejected to a dead-letter queue with the reason; the worker doesn't crash-loop
- [medium · auto] Queue backlog and slow consumers (local only, small) → backlog metric grows and recovers; visibility timeouts don't cause duplicate runs
- [medium · auto] Graceful shutdown and deploy of workers → in-flight jobs finish or return to the queue
- [medium · auto] Job payloads and logs → no secrets or personal data in payloads or job logs {security}

### Data, migrations and observability
- [high · agent] Check the database after each write test → rows, constraints and timestamps are right; failed requests left no partial rows; soft-deleted and deleted data is excluded from reads
- [high · auto] Run migrations on a copy of production-like data, and roll back → they complete in reasonable time; no data loss; rollback works; the old app version still works with the new schema during deploy (expand, migrate, contract) [10]
- [medium · auto] Seed, backup and restore scripts → run on a clean database and produce a working system
- [medium · auto] Metrics, health and alerts: latency, traffic, errors and saturation → exist and respond in a forced-error test [11]
- [medium · auto] Time handling: server time zone, UTC storage, daylight saving, clock skew between instances → timestamps stored in UTC; expiry and scheduling correct

## Gates

- `../features/security.md` for the OWASP API Top 10 and ASVS level 1 checks beyond the basics here.
- Contract suite passing, no breaking-change diff against the last release, migration rehearsal on production-like data, and rate limit and auth grid reviewed by a person are the usual release gates.
- Release blockers specific to APIs: any endpoint returning another user's or tenant's data, missing auth on a private endpoint, 500 for common bad input, a breaking change without a version, secrets in responses or logs, non-idempotent retry of payments or emails.

## Human-only checks

- [human] Read the role and permission table and the list of endpoints → each permission rule matches what the business intends, including edge roles
- [human] Review the business rules the API enforces (prices, limits, state changes, refunds) with the product owner → correct against the real policy
- [human] Run a webhook with the real provider in test mode against a staging URL → events arrive, are verified and processed
- [human] Review rate limits, timeouts and quotas against expected real traffic → sensible
- [human] Approve any production deploy, migration or data change → an agent never writes to production

## Known pitfalls

- **Production is read-only.** Don't send create, update or delete calls to production; use local or test environments with seeded data only.
- **Test mode only for payments and messages.** Stripe-style test keys, email catchers and SMS sandboxes. Never real cards, real emails or real phone numbers.
- **200 with an error body** is a real bug for REST but normal for GraphQL; check the style first.
- **Status 404 vs 403** for other users' objects is a design choice (hide existence or not); file only if it differs from the documented rule or leaks data.
- **Rate limits depend on the proxy.** A local run without a gateway may have none; a 429 in staging can come from the CDN, not the app.
- **Parallel tests need unique data.** Shared test records make concurrency checks flaky; use fresh ids per run.
- **Clock-dependent tests** (token expiry, schedules) are flaky if you rely on real waiting; shorten the lifetime in test config or fake the clock, and retry once before filing.
- **Cold starts and first requests** on serverless are slow; measure the second.
- **Schemathesis finds hypothetical inputs.** Triage each failure: a 500 is a bug; a schema mismatch may be a spec gap; don't file hundreds of duplicates.
- **A 500 in the log may come from your own fuzzing,** which is what the test is for, but record it as a bug only if the response also misbehaved.
- **No load testing of staging or production,** and none of third-party APIs; a tiny local burst only.

## Sources

1. [Schemathesis documentation](https://schemathesis.readthedocs.io/en/stable/) — property-based API testing from OpenAPI and GraphQL; finds 5xx and schema violations, negative cases, stateful chains (checked 2026-11-16)
2. [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) — the contract format (checked 2026-11-16)
3. [Stripe: Webhooks](https://docs.stripe.com/webhooks) — signature checks on raw bodies, retries and duplicate events; example of a provider test mode (checked 2026-11-16)
4. [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) — methods, status codes, `Allow`, `Retry-After`, conditional requests with `ETag` and `If-Match` ; 429 is defined separately in [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585) (checked 2026-11-16)
5. [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10) — BOLA, broken authentication, BOPLA, BFLA, resource consumption, SSRF and more (checked 2026-11-16)
6. [IETF draft: The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) — replay, mismatch and in-flight duplicate behaviour; a draft, not yet a final RFC (checked 2026-11-16)
7. [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) — a standard error shape (checked 2026-11-16)
8. [GraphQL specification](https://spec.graphql.org/) — response and error format (checked 2026-11-16)
9. [gRPC: Status codes](https://grpc.io/docs/guides/status-codes/) — status codes and their meanings (checked 2026-11-16)
10. [M. Fowler: Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) — expand, migrate, contract (checked 2026-11-16)
11. [Google SRE book: Monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/) — the four golden signals (checked 2026-11-16)
12. [OWASP ASVS](https://asvs.owasp.org/) — verification requirements for authentication and access control (checked 2026-11-16)
