---
module: browser-extension-stores
kind: gate
title: Browser extension stores (Chrome, Firefox, Edge, Safari)
checked: 2026-11-16
---
# Browser extension stores (Chrome, Firefox, Edge, Safari)

Pre-checks for publishing a browser extension to the Chrome Web Store, Firefox Add-ons (AMO), Microsoft Edge Add-ons or, through Xcode, the App Store for Safari. Agents prepare, package and pre-check. Store dashboards, uploads and submissions are human steps. Use with `../platforms/browser-extensions.md`, `../features/privacy-consent.md` and `../features/security.md`. For Safari also see `apple-app-store.md`.

## Signals

- A `manifest.json` with `manifest_version`, a `web-ext` or `chrome-webstore-upload` config, a WXT, Plasmo or CRXJS project, or a Safari Web Extension Xcode target.
- The plan names "Chrome Web Store", "AMO", "Edge Add-ons" or "Safari extension".

## Kickoff questions

1. Which stores: Chrome, Firefox, Edge, Safari? (best guess: Chrome and Edge from one build, Firefox if `browser_specific_settings` exists)
2. Does the extension read page content, browsing history, or send data to a server? (best guess: read the code and permissions)
3. Is the code bundled or minified? (best guess: yes if there is a build step; that decides whether Firefox needs source)

## Drivers

1. **Manifest and package inspection.** Read `manifest.json`, unzip the built package, `web-ext lint` for Firefox, `npx` linters for Chrome. Exact and cheap.
2. **Playwright or Puppeteer with the extension loaded** (Chromium persistent context with `--load-extension`) for functional runs, plus `web-ext run` for Firefox. Read the accessibility tree; screenshots at 1280×800 or less.
3. **Network capture** during the run, to compare real traffic with the privacy disclosure and to find remote code loading.
4. **Store dashboards.** Need the user's login. Agents never type store credentials.

**Can't be driven here:** the dashboards, store review, Safari on iOS, and real-user extension updates. Safari needs a Mac and Xcode. These are human, device or gate checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | manifest, permissions and policy checks on the built package |
| full | check, plus a functional run in each browser |
| release | full, plus the listing, disclosure and human review lines |

Dimensions: Chrome, Edge, Firefox, Safari (macOS and iOS); manifest version; minified versus plain code.

## Check catalogue

### Manifest and package
- [high · auto] Built package uses Manifest V3 for Chrome and Edge, and its `manifest.json` validates → store upload accepts it (Chrome requires MV3) (see Sources 1) {smoke}
- [high · auto] Search the unpacked package for `eval()`, `new Function`, remote `<script src>` and dynamic imports of remote URLs → none; Chrome bans remote-hosted code, and logic must be in the package (see Sources 1) {security}
- [high · auto] Content security policy in the manifest doesn't allow remote script sources → CSP is the default or stricter
- [medium · auto] `web-ext lint` on the Firefox build → no errors; warnings reviewed
- [medium · auto] Name, version, description and icons (all required sizes) are present, and the version is higher than the last published → store accepts it
- [medium · auto] Package size and file list: no source maps with secrets, `.env`, tests, `.git` or node_modules by mistake → clean listing {security}
- [high · auto] Search the package for API keys and tokens → none {security}

### Permissions and single purpose (Chrome)
- [high · agent] Write the one-sentence single purpose, then check every feature serves it → no unrelated feature; unrelated features belong in a separate extension (see Sources 1)
- [high · auto] List `permissions`, `host_permissions`, `optional_permissions` and content-script match patterns → each is the narrowest that works; no `<all_urls>` or broad hosts without a reason (see Sources 1)
- [high · agent] Remove each permission in turn, or run with only what is granted, and check which features break → no permission is unused; unused ones are removed
- [medium · agent] Prefer optional permissions that ask at the moment of use → the prompt appears in context
- [medium · human] Write the permission justification text for each sensitive permission, and a short video if the store asks for one → each one explains the feature, not "needed for the extension"

### Privacy and data (Chrome, Edge, Firefox)
- [high · agent] Capture network traffic during a full run → every domain contacted is listed in the privacy policy and the store's privacy practices section; no data goes anywhere undisclosed (see Sources 1) {security}
- [high · agent] Check no browsing history or page content is collected unless a prominent user-facing feature needs it, and it isn't used for ads, sale or credit decisions → pass (limited use rules) (see Sources 1)
- [high · human] Fill the privacy practices fields in the dashboard (data types, single purpose, remote code, limited-use certification) → they match the policy and the real behaviour
- [high · agent] Privacy policy URL works and covers collection, use and sharing → live page, accurate; required when user data is handled
- [medium · agent] Consent or disclosure appears before data collection starts where the policy requires it → no collection before consent
- [medium · auto] User data is sent over HTTPS only → no http calls in the capture {security}

### Functional run
- [high · agent] Load the built package unpacked in Chrome and Edge, then do the core task on a test page and a real site you own → works with no console errors in the service worker or content script {smoke}
- [high · agent] Service worker (MV3) is stopped and restarted (wait for idle or use the Extensions page) → state survives, and the feature still works
- [medium · agent] Install, update from the previous version and uninstall → settings migrate, and uninstall leaves nothing behind
- [medium · agent] Run on pages with strict CSP, iframes, shadow DOM and single-page navigation → no breakage
- [medium · agent] Firefox: load as a temporary add-on and check `browser_specific_settings` ID, minimum version and API gaps → works in Firefox

### Firefox Add-ons (AMO) review
- [high · auto] If the code is minified, bundled or generated, prepare source code and build instructions → README states the OS, tool versions and every command, a lockfile is included, tools are open source and run locally, and the build output matches the submitted files exactly (see Sources 2)
- [high · auto] Rebuild from the source package on a clean machine, using the stated environment (the reviewers' default build machine and its Node and npm versions are listed on the official page) → output has no differences from the submitted add-on
- [medium · auto] No obfuscated code; minified is allowed with source → pass
- [high · gate] Submit to AMO and respond to reviewer questions → add-on is approved and signed; done by a human

### Edge Add-ons and Safari
- [medium · gate] Edge: upload the Chrome-compatible package in Partner Center for Edge Add-ons → certification passes; the listing and privacy fields are complete (see Sources 3)
- [high · agent] Safari: convert with Xcode's web extension converter or `xcrun safari-web-extension-converter`, build and run in Safari on macOS and iOS or iPad → extension appears in Safari settings and works; unsupported APIs are listed (see Sources 4)
- [high · gate] Safari extensions ship inside an app through the App Store, so the app must meet `apple-app-store.md` (privacy answers, screenshots, review notes) → app approved
- [medium · device] Safari on iOS: enable the extension in Settings and grant website access per site → it works only on the sites the user allows

### Listing and review
- [high · human] Store listing has a clear title, description, icon and screenshots showing the real extension, with no keyword stuffing, fake reviews or misleading claims → matches the product (see Sources 1)
- [medium · human] Don't submit duplicate extensions with the same function, or manipulate ratings or installs → none
- [high · gate] Submit to the Chrome Web Store → "published" or a rejection with a reason; human only. Rejections are added to the plan as new checks
- [medium · human] Staged or percentage rollout and deferred publishing, if used → matches the plan

## Gates

MV3 package validates, no remote code, permissions minimal and justified, privacy disclosures match real traffic, source package builds for Firefox, and listings are accurate.

## Human-only checks

- [human] Use the store dashboards to fill listing, privacy and permission fields, upload and submit. Agents never enter store credentials.
- [human] Install the packaged extension from the store's own page after publishing, in a clean browser profile. Judge: it matches the listing and asks only for the permissions you justified.
- [human] Read the privacy policy against the privacy fields.

## Known pitfalls

- Chrome rules and review timing change often, and policies have named sections; quote the text, not only a number.
- Minification is allowed; obfuscation isn't. Don't file minified code as a violation.
- An extension talking to your own server is allowed. Remote logic isn't. Fetching config or data is fine if the logic stays in the package.
- MV3 service workers stop; a "lost state" bug is usually a storage bug, not a store problem.
- Review of the same package can differ between stores. A pass in one doesn't predict the others.
- Don't use real accounts of real people in tests. Use test pages and test accounts.

## Sources

1. [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies) — single purpose, permissions, user data and privacy, remote hosted code, Manifest V3, code readability, metadata, spam (checked 2026-11-16)
2. [Source code submission (Firefox Extension Workshop)](https://extensionworkshop.com/documentation/publish/source-code-submission/) — when source is required, build instructions, reviewer environment (checked 2026-11-16)
3. [Publish an extension to Microsoft Edge Add-ons](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension) — Edge submission (not re-fetched this pass)
4. [Converting a web extension for Safari](https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari) — Xcode conversion (not re-fetched this pass)
