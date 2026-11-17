---
module: web-app
kind: platform
title: Web app (SPA and server-rendered)
checked: 2026-11-16
---
# Web app (SPA and server-rendered)

Covers apps people use in a browser: single-page apps (React, Vue, Svelte, Angular) and server-rendered ones (Next.js, Rails, Django, Laravel, PHP). It covers layout, forms, routing, sessions, caching and cross-browser behaviour. It doesn't cover content-led sites (use `website-content.md`) or the API behind the app (use `apis-backend.md`). It usually goes with `../features/accounts-auth.md`, `../features/forms-validation.md`, `../features/accessibility.md`, `../features/security.md`, `../features/performance.md` and, for a launch, `../gates/web-launch.md`.

## Signals

- `package.json` depends on `react-dom`, `vue`, `svelte`, `@angular/core`, `next`, `nuxt`, `astro`, `remix` or `vite`; or the repo has `manage.py`, `Gemfile` with `rails`, `composer.json` with `laravel`.
- An `index.html` with a script bundle, a `public/` or `templates/` folder, a dev-server script (`npm run dev`).
- The README mentions a URL, "dashboard", "sign in" or a deploy target (Vercel, Netlify, Cloudflare Pages, Fly, Render).
- A `manifest.webmanifest` or service-worker file (also switch on the PWA checks below).

## Kickoff questions

1. Which browsers and devices must work? (best guess: latest Chrome, Edge, Firefox and Safari, desktop plus a phone width)
2. Does it have sign-in or user data, and is there a test account or seed script? (best guess: yes, use the seed data)
3. Is there a deployed staging URL, or do we test the local dev server only? (best guess: local dev server, then staging if one exists)

## Drivers

1. **Playwright CLI or Playwright test runner.** Best default. Runs Chromium, Firefox and WebKit headless, with device and viewport emulation, offline mode, geolocation, locale, time zone, colour scheme and reduced motion [1]. Observe with the accessibility snapshot scoped to the area under test, not the whole page; act on a batch of steps, then observe once. Take screenshots only for visual checks, at 1280×800 or smaller. Limits: the WebKit build is not Safari (see pitfalls); device presets fix the user agent.
2. **Playwright MCP, agent-browser or the host's built-in browser.** Use when the agent can't run scripts or needs an exploratory session. Costs more tokens per step than the CLI; keep snapshots scoped.
3. **Claude in Chrome (the user's real browser).** Only with the user's OK, because it carries real logins and cookies. Use it for flows that need an existing session; never type real credentials.
4. **Chrome DevTools MCP or `lighthouse` CLI.** For performance traces, network and console inspection, and Core Web Vitals lab data [2].
5. **axe-core (`@axe-core/playwright`), `html-validate`, `curl -I`.** Deterministic checks for accessibility rules, HTML errors and response headers. axe catches only part of accessibility problems, so "incomplete" results need a person [3].
6. **The project's own tests** (Vitest, Jest, Cypress, Playwright). Run first and record as the baseline.

**Can't be driven here:** real iOS Safari and real Android Chrome behaviour (touch, keyboard overlays, address-bar resize, notch) need a device or a Mac with the iOS Simulator (device check). Screen-reader experience, visual polish, CAPTCHAs, one-time codes with no test inbox, and real payments are human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Chromium, 1280×800, signed in as the seed user, main task |
| check | smoke cell, plus Firefox and WebKit on the changed flows, plus 390×844 |
| full | pairwise over engine × viewport × colour scheme × zoom × locale × network × role |
| release | every engine × viewport on the top tasks, plus real iPhone Safari and Android Chrome, plus human checks |

Dimensions: engine (Chromium, Firefox, WebKit); viewport (390, 768, 1280, 1920 wide); zoom (100%, 200%, 400%); colour scheme (light, dark, forced colours); reduced motion; locale and time zone; network (fast, slow 3G, offline); role (anonymous, user, admin); signed-in state.

## Check catalogue

### Smoke
- [high · agent] Open the home or app URL on a clean profile → the page renders its main content with no console errors and no failed requests {smoke}
- [high · agent] Sign in with the seed user, do the main task, reload → the result is still there {smoke}
- [high · auto] Run `npm run build` (or the framework's production build) and start the production server → build exits 0 and the app serves the same main screen {smoke}

### Responsive layout and zoom
- [high · agent] Load the main screens at 390, 768, 1280 and 1920 px wide → no horizontal scrollbar on the page, nothing cut off or overlapping, every control reachable {a11y}
- [medium · agent] Zoom to 200% and 400% (or set a 320 px wide viewport) → content reflows into one column, no two-direction scrolling, no hidden controls {a11y}
- [medium · agent] Rotate the viewport (portrait to landscape) mid-flow → layout adapts, form values and scroll position are kept
- [medium · agent] Set a larger default browser font size → text grows, nothing is clipped by fixed heights
- [medium · agent] Long names, long words and long tables in cards and tables → they wrap, truncate with a tooltip, or scroll inside their own container
- [low · agent] Print preview of the main content page → readable, no cut-off, nav hidden if the product claims printing
- [medium · agent] Sticky headers, banners and cookie bars → they don't cover the focused control or the page's main content {a11y}
- [medium · agent] Dark mode and forced-colours emulation → text is readable, icons and borders visible, no white flashes on load

### Forms
- [high · agent] Submit every form empty, with one field wrong, and with all valid → errors sit beside the fields, focus moves to the first error, valid input is kept
- [high · agent] Submit with the server rejecting the request (stop the backend or force a 500) → form values stay, a human message appears, the button re-enables
- [medium · agent] Double-click the submit button and press Enter twice → one record is created and the button disables while sending
- [medium · agent] Use browser autofill, a password manager and paste into each field → values are accepted and validated as if typed
- [medium · agent] Check each input's `type`, `autocomplete` and `inputmode` → email, phone and number fields show the right mobile keyboard and autofill hints {a11y}
- [medium · agent] Reload mid-form and use Back after submitting → either the draft is kept or the user gets a warning; Back doesn't resubmit a POST silently
- [low · agent] Leave a long form mid-way and navigate away → an "unsaved changes" prompt appears if the product promises it

### Routing and deep links
- [high · agent] Open each main route by pasting its URL in a fresh tab (signed in and signed out) → the right page shows, or a redirect to sign-in that returns to the same page afterwards
- [high · agent] Request an unknown route and an unknown id (`/orders/999999`) → a real 404 page (HTTP 404 status on server-rendered apps), not a blank screen or a spinner forever
- [medium · agent] Use Back, Forward and refresh across five steps of the main flow → the URL, page and state agree each time; no redirect loop
- [medium · agent] Check that filters, tabs, search terms and pagination appear in the URL → copying the URL into a new tab reproduces the view
- [medium · agent] Open links with trailing slash, uppercase, query strings and hash fragments → they resolve or redirect once to the canonical form
- [medium · agent] Click an external link and a `target=_blank` link → external links open safely (`rel="noopener"`), and in-app links don't reload the whole page

### Hydration and rendering (server-rendered and SPA)
- [high · agent] Load each server-rendered page with the console open → no hydration mismatch warnings (text, attributes or markup differ between server and client) [4]
- [medium · agent] Disable JavaScript for one load of a server-rendered page → the main content is still present if the product claims server rendering
- [medium · agent] Time-, random- and locale-dependent text (dates, greetings, ids) → the same on server and client after load; no flash of different content
- [medium · agent] Reload on a slow network → a loading state appears, no layout jump larger than a line of text, no flash of unstyled content

### Sessions, cookies and storage
- [high · auto] Inspect `Set-Cookie` on the session cookie → `HttpOnly` and `Secure` set (on HTTPS), `SameSite` set, a sensible expiry {security}
- [high · agent] Sign out, then press Back and open a protected URL → protected data is not shown; the sign-in page appears {security}
- [high · agent] Sign in in two tabs, sign out in one, act in the other → the second tab is told the session ended and doesn't show stale private data {security}
- [medium · agent] Expire the session (delete the cookie or wait out a short test lifetime) mid-form → a clear prompt to sign in again and the form data is not lost
- [medium · agent] Block third-party cookies and clear site data mid-session → the app still works for first-party features or explains what is needed
- [medium · agent] Check what's in `localStorage`, `sessionStorage` and IndexedDB → no tokens with long life, secrets or personal data stored without need {security}
- [medium · agent] Private window, and storage blocked → the app degrades with a message rather than a blank page or an exception loop
- [medium · agent] Change the system time zone and clock (Playwright `timezoneId`) → dates and "x minutes ago" text stay correct

### Caching, service workers and updates
- [high · agent] Deploy or rebuild a new version, then reload in a tab that was open on the old version → the user gets the new version (or an "update available" prompt) and the old JS chunk doesn't throw "ChunkLoadError" or a 404
- [medium · auto] Check `Cache-Control` on HTML, hashed assets and API GETs → HTML is revalidated, hashed assets are long-lived and immutable, private data isn't cached by shared caches {security}
- [medium · agent] If a service worker exists: install, update and unregister it → new versions activate, stale caches are removed, a hard reload recovers a broken page [5]
- [medium · agent] Go offline on a PWA → the offline page or cached shell shows with a clear message; writes are queued or refused with an explanation
- [low · auto] Check the web app manifest (name, 192 and 512 px icons, `start_url`, `display`) → Chrome's install criteria are met if the product promises installability [6]

### Cross-browser
- [high · agent] Run the top three tasks in Chromium, Firefox and WebKit → same results in all three; differences are filed with the engine named [7]
- [medium · agent] Check date pickers, file inputs, `<dialog>`, `:has()`, container queries and `backdrop-filter` if used → work or degrade gracefully in each engine
- [medium · agent] Check scroll-snap, `100vh` and sticky behaviour at phone width in WebKit → no content hidden under dynamic toolbars
- [low · device] Open the top task on a real iPhone (Safari) and a real Android phone (Chrome) → layout, keyboard overlay, file picker and camera upload work

### Security and headers (basics; deeper checks in the security pack)
- [high · auto] Fetch the production HTML and check `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, frame protection and HSTS → present and not obviously wide open {security}
- [high · agent] Put `<script>alert(1)</script>` and `"><img src=x onerror=alert(1)>` into every text field and URL parameter → shown as text, nothing runs {security}
- [high · agent] Open a page for another user's record by changing the id in the URL → access denied or 404, never the other user's data {security}
- [medium · auto] Search the shipped JS bundles and source maps for API keys, tokens and `service_role`-style secrets → none found {security}
- [medium · agent] State-changing requests from a page on another origin (forged form post) → rejected (CSRF protection or SameSite cookies) {security}

### Accessibility (basics; deeper checks in the accessibility pack)
- [high · auto] Run axe on each main screen → no serious or critical violations; review the "incomplete" list by hand {a11y}
- [medium · agent] Tab through each main screen → visible focus on every control, logical order, no keyboard trap, modals trap focus and return it on close {a11y}
- [medium · agent] Text and control contrast, touch target size (about 24 px minimum by WCAG 2.2, larger on phones) → meets the stated level {a11y}

## Gates

- `../gates/web-launch.md` for the 14-check launch gate against the deployed URL.
- `../gates/accessibility-law.md` and `../gates/privacy-law.md` when the product serves the EU, US or children.
- Field Core Web Vitals (LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 at the 75th percentile) need real-user data; lab runs are only a guide [2].

## Human-only checks

- [human] Open the app in Safari on an iPhone, then sign in, do the main task, rotate the phone, switch to another app and come back → the page still works and keeps its state
- [human] Turn on VoiceOver (iOS or macOS) or NVDA (Windows) and do sign-in plus the main task → each control is announced with a sensible name and the flow is possible without sight
- [human] Look at the main screens at phone and desktop width → spacing, type and colour look intentional, not broken
- [human] Complete any CAPTCHA, email-link or SMS code step with test accounts → the flow reaches the signed-in state

## Known pitfalls

- **Playwright WebKit isn't Safari.** Layout is close; iOS-specific behaviour (viewport units, keyboard, PWA install, ITP cookie limits) needs a real device before you report it.
- **Dev-server noise.** React StrictMode double-renders and logs, Vite and Next dev overlays, HMR websocket errors and "source map not found" are not product bugs.
- **Hydration warnings caused by browser extensions** (translation, Grammarly, dark-mode injectors) are false alarms; test in a clean profile.
- **Cold starts and first-load slowness** on free hosting tiers are an environment issue, not a performance bug, unless production is the same.
- **Console warnings from third-party scripts** (analytics, chat widgets) are noted, not filed, unless they break the page.
- **`axe` has false negatives and some false positives.** Don't mark accessibility as passed on a clean axe run alone.
- **A single failure may be flakiness.** Retry once and record n/N before filing.
- **Cached state hides bugs.** Test once with a fresh profile and once with a returning one.
- **Never log in with a real account or real payment.** Use seeded or test accounts and a payment provider's test mode only.

## Sources

1. [Playwright: emulation](https://playwright.dev/docs/emulation) — viewport, locale, time zone, colour scheme, offline; device presets fix the user agent (checked 2026-11-16)
2. [web.dev: Web Vitals](https://web.dev/articles/vitals) — LCP, INP and CLS "good" thresholds at the 75th percentile (checked 2026-11-16)
3. [Deque: automated testing study](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues) — automated tools find only part of the issues (checked 2026-11-16)
4. [Next.js: react-hydration-error](https://nextjs.org/docs/messages/react-hydration-error) — what hydration mismatches are and typical causes (checked 2026-11-16)
5. [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) — install, update and cache lifecycle (checked 2026-11-16)
6. [web.dev: Install criteria](https://web.dev/articles/install-criteria) — manifest and install requirements (checked 2026-11-16)
7. [web.dev: Baseline](https://web.dev/baseline) — the core browser set (checked 2026-11-16)
8. [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/) — reflow, target size, focus not obscured (checked 2026-11-16)
9. [OWASP ASVS](https://asvs.owasp.org/) — session and cookie requirements (checked 2026-11-16)
