---
module: analytics-events
kind: feature
title: Analytics events
checked: 2026-11-16
---
# Analytics events

Covers the product's own usage tracking: event names and properties, whether each event fires exactly once at the right moment, that no personal data leaks into events, that consent is respected, that funnels reflect the real product, and that test traffic doesn't pollute production data. Goes with `privacy-consent.md` (consent and personal data), `onboarding.md` (funnels), `payments-subscriptions.md` (revenue events) and `integrations-webhooks.md`.

## Signals

- Analytics SDKs: `gtag`/`GA4`, `@segment/analytics-next`, `mixpanel`, `amplitude`, `posthog`, `plausible`, `firebase/analytics`, `appsflyer`, `adjust`, `rudderstack`, `snowplow`, a `track()` or `logEvent()` helper.
- A tracking plan, event dictionary, `events.ts`/`analytics.md`, a data layer (`window.dataLayer`), a tag manager container.
- Dashboards, funnels or A/B testing in the README or the product (feature flags with exposure events).

## Kickoff questions

1. Is there a tracking plan or event list, and which tool receives the events? (best guess: derive the list from the code, tool from the SDK)
2. Is there a separate analytics project for development and test? (best guess: unknown; check keys per environment)
3. Which funnels or numbers does the business actually act on? (best guess: sign-up, activation, checkout)

## Drivers

1. **Network and data-layer capture in Playwright.** Record outbound requests to the analytics host (`page.on('request')` filtered by domain, e.g. `google-analytics.com/g/collect`, `api.segment.io`, `app.posthog.com`, `api-js.mixpanel.com`, `region1.google-analytics.com`), or read `window.dataLayer`. Parse the payloads into event name plus properties. Deterministic and cheap; the main driver for web.
2. **Debug modes from the vendor.** GA4 DebugView (`debug_mode`) and Realtime report, Segment Debugger, Mixpanel live view, PostHog's activity view, Firebase DebugView (`adb shell setprop debug.firebase.analytics.app <package>`), Amplitude's event stream. Use the staging project only.
3. **Mobile traffic capture.** A proxy (mitmproxy, Charles) with a test device or emulator, or the SDK's debug logging in `adb logcat` / the Xcode console. Limit: certificate pinning may hide traffic.
4. **Event schema validation.** If there's a tracking plan (JSON Schema, Segment Protocols, Avo, Amplitude Data), validate captured events against it with a script.
5. **Code search.** `grep` for `track(`, `logEvent(`, `capture(` and compare with the dictionary: events in code but not in the plan, and the reverse.
6. **Warehouse or dashboard queries (read-only)** to confirm the events arrived and the funnel counts add up in a staging project.

**Can't be driven here:** whether a dashboard drives the right decisions, business definitions of "active user", attribution accuracy across ad networks, and any production analytics project (read-only; never inject test events into it). Those are human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Load the app fresh, perform the top action: the expected events appear once with the right properties |
| check | Smoke, plus events for each changed feature, plus the consent reject case |
| full | Every event in the plan × (first time, repeat, error path) × consent state × platform (web, iOS, Android) × logged-in/out |
| release | Full, plus funnel reconciliation in staging, plus production-pollution check on keys and environment |

Dimensions: event, platform, consent state, user state (anonymous, signed in, new, returning), environment (dev, staging, production), network state (online, offline then online).

## Check catalogue

### Events fire once, at the right time
- [high · agent] Perform each tracked action once (view, click, submit, purchase) and capture requests → exactly one event per action, with the planned name; not zero, not two {smoke}
- [high · agent] Double-click a tracked button, press Enter twice, reload on a result page, press back and forward → no duplicate events for one real action; page-view events aren't doubled by SPA route changes or React strict mode in the production build
- [high · agent] Events fire after the action succeeded, not on click: submit a form that the server rejects → no "signup_completed" event; a failed payment sends no "purchase" {smoke}
- [medium · agent] Events carry a stable event ID or timestamp so retries can be deduplicated → true where the tool supports it
- [medium · agent] Events that should fire on page or screen load (view events) fire once per view; not on every re-render or scroll tick
- [medium · agent] Background and unload: events sent on tab close or app background arrive (`sendBeacon`, flush on pause) → present in the debug view
- [medium · agent] Offline then online (mobile queue) → queued events are delivered once, in order, with their original timestamps
- [medium · agent] Event volume check: perform the main flow and count requests → no chatty events (an event per keystroke, per scroll pixel or per second) beyond what the plan says
- [low · agent] A tab left idle for 10 minutes → no heartbeat spam beyond the plan

### Names and properties are right
- [high · auto] Validate each captured event against the tracking plan or schema → name, required properties, types, enums and casing match; no unknown events or properties {smoke}
- [medium · agent] Property values are real → no `undefined`, `null`, `NaN`, `[object Object]`, empty strings or placeholder values; numbers are numbers (price as 19.99, not "19.99 USD")
- [medium · agent] Currency and units → ISO currency codes, consistent cents or decimals, same units everywhere
- [medium · agent] Identifiers → user ID is stable across sessions and devices after login; anonymous ID links to the user ID at login (identify call) and doesn't change on each visit
- [medium · agent] Common properties on every event (app version, platform, locale, environment, session ID) → present and correct; the version equals the build under test
- [medium · agent] Names follow one convention (snake_case or Title Case, noun_verb) → consistent across the plan and the code
- [medium · agent] Event properties for items in lists (product ID, position, search term count) → match the item the user acted on, not the first item
- [low · agent] Super-properties and user properties (plan, role) update after a change (upgrade, logout) → not stale

### No personal data in events
- [high · agent] Inspect every payload for emails, names, phone numbers, addresses, IP in properties, free-text input (search queries, messages, form values), auth tokens, passwords, card numbers → none unless the privacy policy allows and consent covers it {smoke} {security}
- [high · agent] Type a distinctive fake name, email and message (for example `zz-test-person@example.com`) in forms and search, then search the captured traffic for that string → not found in analytics requests, URLs or referrers
- [medium · agent] URLs sent as page properties → no tokens, reset links, email addresses or IDs in query strings (strip or redact them)
- [medium · agent] Session replay and heatmaps (if present) → inputs, passwords and payment fields are masked; no capture of private pages
- [medium · agent] User IDs → an internal opaque ID, not an email or phone; hashing an email isn't anonymisation
- [medium · agent] Error and crash reports (Sentry etc.) → no personal data in messages, breadcrumbs or context

### Consent respected
- [high · agent] Fresh visitor with no consent choice, in a region needing consent → no analytics events or analytics cookies until consent (see `privacy-consent.md`) {smoke}
- [high · agent] Reject all → zero analytics requests afterwards, including from the SDK's batching queue; events created before the rejection are discarded, not sent later
- [medium · agent] Accept, then withdraw → events stop; stored identifiers are reset
- [medium · agent] Consent mode signals (for example Google Consent Mode defaults `denied`) → sent as designed; modelled pings contain no identifiers beyond what the policy allows
- [medium · agent] "Do Not Track" and Global Privacy Control → honoured if the product says so
- [medium · agent] Cookieless or aggregated mode (Plausible, server-side) → the product's claim of "no cookies" is true in the cookie list
- [medium · agent] Mobile: ATT denied, or OS ad tracking off → no advertising IDs in payloads

### Funnels match the product
- [high · agent] Walk the main funnel (landing → sign-up → activation → purchase) in order and list the events → each step has an event; the order and step count match the product's real screens; no skipped or extra steps
- [high · agent] Take paths that skip steps or loop back (deep link to step 3, go back to step 1, abandon and return) → events remain sensible; the funnel doesn't count one user as completing a step they didn't
- [medium · agent] Reconcile counts in staging: run the flow 10 times with test users, then compare the analytics counts with the database (orders, sign-ups) → equal
- [medium · agent] Revenue events: amount, currency, item and order ID equal the real order and fire once per order, including after payment webhooks (see `payments-subscriptions.md`)
- [medium · agent] A/B test exposure events → fire once per user per experiment at the moment of exposure; the variant name matches what the user saw
- [medium · agent] Feature flags and rollouts → events carry the flag state
- [low · agent] Funnel definitions in dashboards use the event names that the product actually sends today (not old, renamed ones)

### Environments and pollution
- [high · auto] Check analytics keys per environment (dev, test, staging, production) → development and test builds use a separate project or write key; the production key isn't present in a local or test build {smoke}
- [high · agent] Run the automated test suite and a manual session against the dev build, then check the production analytics project (read-only) → no events from test users, bots, localhost or CI
- [medium · agent] Internal and test traffic is marked or filtered (internal user flag, IP filter, `is_test` property, test accounts excluded) → true; QA runs add no noise to dashboards
- [medium · agent] Bots, crawlers and headless browsers → excluded or flagged
- [medium · agent] Staging and preview deployments (Vercel previews, review apps) → use the staging key
- [medium · agent] Event schema versions after a release → old app versions still sending old event shapes are handled; renamed events are mapped
- [low · agent] Sampling and rate limits in the tool → known; an unexplained gap isn't a bug

### Reliability and performance of tracking
- [medium · agent] Block the analytics domain (ad blocker, firewall) → the product works normally; no errors, no blank page, no blocked checkout
- [medium · agent] Analytics script failing or slow (mock 500 or a 10 s delay) → page load and interactions aren't blocked; the script loads async
- [medium · agent] Console and network → no analytics errors, 4xx from the tool (bad key, bad payload), or CORS errors
- [medium · agent] Payload size and request count per page → within the vendor's limits; batch sizes sensible
- [low · agent] Analytics SDK weight in the bundle → noted in the performance baseline (see `performance.md`)

## Gates

- Privacy law gate for consent and personal data: `../gates/privacy-law.md`.
- App store privacy answers must list the analytics SDKs and data they collect; see the store gates.

## Human-only checks

- [human] Review the tracking plan with the owner → each event answers a real question the business asks; unused ones are removed.
- [human] Check production dashboards after release → numbers look plausible against known real activity; no spikes from a test run.
- [human] Review third-party analytics data-processing terms and retention settings in the vendor dashboard → match the privacy policy.

## Known pitfalls

- **Dev servers double-fire.** React strict mode and hot reload send some events twice in development; check the production build before reporting duplicates.
- **GA4 batches and delays.** Realtime shows events within seconds, standard reports take hours; use DebugView or the network log, not reports.
- **Consent tools in headless browsers.** Banners may not show; see `privacy-consent.md` for forcing the region.
- **Events blocked by your own extensions.** Use a clean automation profile.
- **Cached page views after back/forward** don't always fire; check the plan's intent before filing.
- **Don't send test events to production** while checking; never "just try it" on the live project.
- **A missing event isn't a bug if the plan omits it.** File a question for the owner instead.
- **Hashed emails still count as personal data** under many laws; flag them as a question, not a verdict.

## Sources

1. [Google Analytics: DebugView](https://support.google.com/analytics/answer/7201382) — GA4 debug mode for validating events (checked 2026-11-16)
2. [Google: Consent Mode](https://developers.google.com/tag-platform/security/guides/consent) — consent signals for Google tags (checked 2026-11-16)
3. [Segment: Tracking plan and Protocols](https://segment.com/docs/protocols/) — validating events against a schema (checked 2026-11-16)
4. [Playwright: Network events](https://playwright.dev/docs/network) — capturing requests (checked 2026-11-16)
5. [Fowler: Synthetic monitoring](https://martinfowler.com/bliki/SyntheticMonitoring.html) — identifiable test accounts, keep test traffic out of analytics (checked 2026-11-16)
6. [GDPR Article 5](https://gdpr-info.eu/art-5-gdpr/) — data minimisation principle (checked 2026-11-16)
