---
module: browser-extensions
kind: platform
title: Browser extensions (Chrome MV3, Firefox, Edge, Safari)
checked: 2026-11-16
---
# Browser extensions

Covers extensions for Chrome and other Chromium browsers (Manifest V3), Firefox, Edge and Safari: manifest and permissions, the background service worker or event page, content scripts, popup, options and side-panel pages, storage, updates and cross-browser differences. It goes with `web-app.md` for any pages the extension ships, with `../features/security.md` and `../features/privacy-consent.md`, and for release with `../gates/browser-extension-stores.md`.

## Signals

- A `manifest.json` with `manifest_version`, `background`, `content_scripts`, `action`, `permissions` or `host_permissions`.
- A `browser_specific_settings.gecko` key (Firefox); `safari-web-extension` project files or an Xcode project with a Safari extension target.
- Dependencies on `webextension-polyfill`, `plasmo`, `wxt`, `crxjs`, `web-ext`, `@types/chrome`.
- README words: "browser extension", "Chrome Web Store", "Add-ons", "content script".

## Kickoff questions

1. Which browsers must it ship to, and which manifest version? (best guess: Chrome and Edge on MV3; Firefox if `browser_specific_settings` is present)
2. Which sites does it act on: all sites, a short list, or only the active tab on click? (best guess: read `host_permissions` and `matches`)
3. What does it store or send out, and where? (best guess: local storage only; list any network calls found in the code)

## Drivers

1. **Project tests.** Unit tests (Vitest, Jest) for logic; run and record as the baseline. Mock `chrome.*` with `sinon-chrome` or `jest-webextension-mock` only for unit tests, not as evidence of browser behaviour.
2. **Playwright persistent context with the unpacked extension (Chromium).** `chromium.launchPersistentContext(userDataDir, { channel: 'chromium', args: ['--disable-extensions-except=<path>', '--load-extension=<path>'] })`. Extensions only work in a persistent context. Branded Chrome and Edge no longer accept the side-load flags, so use Playwright's bundled Chromium. Get the extension ID from the service worker URL (`context.serviceWorkers()` or the `serviceworker` event), then open `chrome-extension://<id>/popup.html` and the options page as normal pages. Headless works with `channel: 'chromium'`; use headed for anything involving the toolbar. Observe with scoped accessibility snapshots and `page.evaluate`; screenshots only for visual checks at 1280×800 or less [1].
3. **Service-worker control.** In Playwright, call `serviceWorker.evaluate(...)` to read state; the same handle survives suspension, and calls in flight during a suspend fail with "Service worker restarted". To test termination, stop the worker through the Chrome DevTools Protocol (`ServiceWorker.stopAllWorkers` or the `chrome://serviceworker-internals` page) or wait more than 30 seconds idle. Selenium's ChromeDriver keeps workers alive, so it can't test termination [2][3].
4. **`web-ext` for Firefox.** `web-ext run` launches Firefox with the extension and a temporary profile; `web-ext lint` checks the manifest and APIs; `web-ext build` makes the package. Firefox extension automation through Playwright is limited, so use Selenium with geckodriver and `install_addon`, or `web-ext` plus a human pass [4].
5. **Static validators.** `web-ext lint` (works for Chrome manifests too), a JSON schema check on `manifest.json`, `eslint-plugin-no-unsanitized`, `semgrep`, `npm audit`. Read the manifest first: permissions and `content_security_policy` tell you most of the risk.
6. **A local fixture site.** A tiny local server with the page types the extension targets (plain page, SPA that changes the DOM, page with iframes, strict-CSP page, shadow DOM, a page with the extension's own injected markers). Test the extension against fixtures, not real sites.
7. **Safari.** Xcode builds the extension inside an app; `xcrun safari-web-extension-converter` converts a Chrome extension. It runs only on macOS.

**Can't be driven here:** Safari on Windows or without a Mac; the browser toolbar's puzzle-piece pinning, native permission prompts and the real Web Store install flow (human or device); Chrome and Edge branded builds with side-load flags (use Chromium, then a human pass on branded Chrome through "Load unpacked"); other users' real accounts and real sites with logins (use fixtures or test accounts the user supplies); store review (gate).

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Chromium, fresh profile, extension loaded, popup opens, core action works on one fixture page |
| check | smoke cell, plus the changed feature on SPA and iframe fixtures, plus a worker-suspend cycle |
| full | pairwise over browser × profile type × permission state × page type × MV version |
| release | Chrome, Edge, Firefox (and Safari if shipped) on each OS, update from the last published version, incognito, plus human checks |

Dimensions: browser and channel (stable, beta); OS; profile (fresh, with other extensions, signed-in sync, incognito); host-permission state (granted, denied, "on click" only); page type (static, SPA, iframe, strict CSP, shadow DOM, PDF, `file://`, `chrome://` pages); language and zoom; MV2 versus MV3 where both exist.

## Check catalogue

### Manifest and permissions
- [high · auto] Validate `manifest.json` (`web-ext lint`, schema, load unpacked) → loads without errors or warnings in `chrome://extensions` and the lint output {smoke}
- [high · agent] Read every entry in `permissions`, `host_permissions` and `optional_permissions`, and match each to a feature that uses it → no unused permission; nothing broader than needed (a named host instead of `<all_urls>` where possible) {security}
- [medium · agent] Move non-essential permissions to optional and request them at the moment of use → the prompt appears on a user gesture, with context; declining leaves the rest of the extension working
- [medium · agent] Deny each host permission in turn (site access "on click", "on specific sites") → the extension explains what it can't do and doesn't spin or throw errors
- [medium · auto] Check `content_security_policy`, `web_accessible_resources`, `externally_connectable` and `minimum_chrome_version` → no `unsafe-eval` or remote script hosts; only needed resources are web-accessible; the minimum version covers the APIs used {security}
- [medium · agent] Compare the permission-warning text Chrome shows at install with the store listing and privacy policy → the listing and policy cover everything the warnings imply
- [high · auto] Search the code for remotely hosted code, `eval`, `new Function` and loading scripts from a URL → none; all logic ships in the package {security}

### Service worker and background logic (MV3)
- [high · agent] Do an action, wait over 30 seconds idle (or stop the worker through the DevTools protocol), then do the action again → still works; state came from `chrome.storage`, not from globals {smoke}
- [high · auto] Grep the worker for state in module-level variables, `setTimeout`/`setInterval` for long waits, and listeners registered asynchronously → listeners are registered synchronously at the top level; timers use `chrome.alarms` (minimum period is respected)
- [medium · agent] Fire an event that wakes a dead worker (alarm, message, `webRequest` or `tabs` event, notification click) → the handler runs once and completes; no lost first event
- [medium · agent] Run a long task (a fetch over 30 seconds, or work over 5 minutes) → completes, or is resumed after suspension; the extension does not keep the worker alive with hacks that the store forbids
- [medium · agent] Check the worker for unhandled promise rejections and errors in the service-worker DevTools console after each flow → none
- [medium · agent] Install, disable, re-enable, reload and update the extension while a tab is open → the content script on already open tabs shows "context invalidated" handling, not an uncaught error; the page isn't broken
- [low · agent] Check `chrome.runtime.onInstalled` for `install`, `update` and `browser_update` reasons → first-run setup happens once; updates don't repeat the welcome flow

### Content scripts and pages
- [high · agent] Open the fixture pages (static, SPA with client-side navigation, iframe, shadow DOM, strict-CSP) and run the main action on each → works on every page type it claims to support {smoke}
- [high · agent] Navigate inside an SPA without reloading and change the DOM under the injected UI → the injected UI survives, re-attaches or cleans up; no duplicates after repeated navigation
- [medium · agent] Check `matches`, `exclude_matches`, `all_frames`, `match_about_blank` and `run_at` against real behaviour → it runs where listed and nowhere else; no injection on pages it shouldn't touch
- [medium · agent] Compare the page before and after injection (layout, fonts, global CSS, `window` globals) → the host page isn't visibly changed except by the feature; injected UI is isolated (shadow DOM or scoped CSS) and the page's CSS doesn't break it
- [medium · agent] Run on pages with a strict CSP and on pages with heavy scripts (a large web app) → content script works; no page slowdown noticeable in a performance trace
- [medium · agent] Test restricted pages (`chrome://`, the Web Store, PDF viewer, `file://` without permission, `about:blank`) → the extension fails gracefully with a message, not a silent no-op or console error flood
- [medium · agent] Open the page in several tabs and windows, then use the extension in each → state and messages go to the right tab; no cross-tab leakage
- [medium · auto] Check message passing (`runtime.sendMessage`, `tabs.sendMessage`, ports) with the receiver absent → handles "Receiving end does not exist" with a clear fallback
- [high · agent] Feed hostile page content (HTML with `<script>`, `onerror`, huge text, links with `javascript:`) into anything the extension reads and renders → output is escaped; no `innerHTML` with page data; nothing executes {security}

### Popup, options, side panel and shortcuts
- [high · agent] Open the popup, options page and side panel (if any) from the extension ID URL and from the toolbar → each renders in under a second with no console errors {smoke}
- [medium · agent] Resize the popup to its minimum and maximum, and test at 200% zoom and in dark mode → nothing is cut off; scrolling works; text is legible {a11y}
- [medium · agent] Tab through the popup and options with the keyboard only; check labels, focus order and contrast → every control reachable and labelled, visible focus {a11y}
- [medium · agent] Check each keyboard shortcut in `commands` → triggers the action; conflicts with browser shortcuts are handled; users can rebind at `chrome://extensions/shortcuts`; the shortcut works when the popup is closed
- [medium · agent] Change a setting in options with the popup open and with a second window → both reflect the change (storage events); no stale value
- [low · agent] Check the context menu items, omnibox keyword and badge text if used → items appear only where relevant; badge clears when done
- [medium · agent] Check `chrome.i18n` strings with another locale (`--lang`) and pseudo-localised strings → no missing keys (`__MSG_x__` visible), no truncation

### Storage, sync and updates
- [high · agent] Save settings, restart the browser, reopen → settings persist {smoke}
- [medium · agent] Fill `storage.sync` close to its documented quota (read the current limits in the Chrome storage docs) and `storage.local` with a large value → a clear error or fallback, not silent data loss
- [medium · agent] Sign in to two profiles with sync on and change a setting on one → the other updates, with no conflict loops; sensitive data isn't put in sync storage unless disclosed
- [high · agent] Install the last published version, create data and settings, update to the candidate (load the new build over the old profile) → data is migrated; the extension version in the UI changes; no re-onboarding; no data loss
- [medium · agent] Downgrade or load an older version over newer data → does not crash; or the limit is documented
- [medium · agent] Check uninstall behaviour (`setUninstallURL` page, leftover data, alarms) → clean; the uninstall page doesn't send identifying data
- [medium · agent] Run in an incognito window with and without "Allow in Incognito" → follows the declared `incognito` mode; nothing from incognito sessions is written to normal-profile storage or logs {security}
- [low · agent] Check enterprise or managed policy storage (`storage.managed`) if used → policy values override user settings and are shown as locked

### Network, privacy and security
- [high · agent] Record all network requests from the worker, popup and content scripts for the main flows → only hosts that the privacy policy and listing disclose; no analytics or tracking before consent {security}
- [high · agent] Inspect what is sent (headers, bodies, query strings) → no browsing history, page content or identifiers beyond what is disclosed; no secrets in URLs {security}
- [medium · agent] Block each backend host and re-run → clear offline or error state; no infinite retry loop
- [medium · auto] Check dependencies (`npm audit`, licence check) and bundled third-party libraries → no known high or critical issue; versions are current
- [medium · agent] Check that API keys, tokens and user data aren't embedded in the package → none; secrets stay on a server {security}
- [medium · agent] Check for affiliate-link injection, search or new-tab hijacking, ad injection and settings changes the user didn't request → none; store policy forbids them [5] {security}

### Cross-browser
- [high · agent] Load the same source on Firefox through `web-ext run` and on Edge, repeat the smoke flow → works, or each difference is a documented, deliberate gap
- [medium · auto] Check API differences (`browser.*` Promises versus `chrome.*` callbacks, `background.service_worker` versus `background.scripts`, `sidePanel` versus `sidebar_action`, `declarativeNetRequest` support) → code paths exist for each target; unsupported features degrade cleanly
- [medium · device] Load on Safari through Xcode on a Mac; enable the extension in Safari settings and grant per-site access → works; permissions flow follows Safari's prompts
- [low · agent] Check coexistence with other popular extensions (ad blocker, password manager, dark mode) → no conflict in the main flow

## Gates

Store submission is human-only: see `../gates/browser-extension-stores.md`. Block release on:

- Any unvalidated manifest error, unused broad permission, or remotely hosted code.
- The extension fails after a service-worker suspension.
- Update from the last published version loses data.
- Network traffic that the privacy policy and listing don't disclose.
- A content-script injection that breaks a fixture page, or unescaped page data rendered as HTML.

## Human-only checks

- [human] On branded Chrome, open `chrome://extensions`, turn on developer mode, click "Load unpacked", pick the build folder, pin the icon and use the main feature on three real sites you choose → it works and the page looks normal.
- [human] Read the install-time permission warning and the store listing side by side → would a user understand what they are granting? Is anything surprising?
- [human] Judge the popup's look and feel at normal use → clear, quick, nothing jarring.
- [human] Submit the package to each store with your own developer account, answer the privacy questionnaire and track the review → listed and installable. (Agents never submit.)
- [human] On a Mac, run the Safari build and enable it in Safari settings → works and the permission prompts make sense.

## Known pitfalls

- **Playwright headless and branded Chrome.** The extension won't load in branded Chrome or Edge with the side-load flags, and it won't load outside a persistent context. That is a test-setup limit, not an extension bug [1].
- **The worker looks "dead" in DevTools.** Opening DevTools on the service worker can keep it alive and hide suspension bugs. Test suspension with DevTools closed.
- **"Service worker restarted" errors in Playwright** are from calls in flight during suspension, not necessarily a bug in the extension [1].
- **"Extension context invalidated"** after reloading or updating an extension is expected on already open tabs. It's a bug only if it surfaces as a visible failure on the page.
- **Console noise from the host page** (a site's own errors, blocked trackers) isn't the extension's. Filter by the extension's source.
- **Restricted pages.** Content scripts can't run on the Web Store, `chrome://` pages or other extensions' pages. Don't file "doesn't work on chrome://".
- **Cross-origin fetches in content scripts** follow the page's origin; moving the call to the worker is the usual fix. Check that it is a real bug on the claimed sites.
- **Store listing versus manifest.** The version shown in the store lags the manifest by review time; compare against the package, not the page.
- **Firefox and `web-ext lint` warnings** about Chrome-only keys aren't errors for a cross-browser build.

## Sources

1. [Playwright: Chrome extensions](https://playwright.dev/docs/chrome-extensions) — persistent context, `--load-extension`, service-worker access, headless with `channel: 'chromium'`, "Service worker restarted" (checked 2026-11-16)
2. [Chrome: extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30 s idle, 5 min event, 30 s fetch limits (checked 2026-11-16)
3. [Chrome: end-to-end testing of extensions](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing) — Puppeteer, Selenium limits for worker termination (checked 2026-11-16)
4. [Mozilla: web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) — run, lint and build for Firefox (checked 2026-11-16)
5. [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies) — single purpose, minimal permissions, no remote code, disclosures, no deceptive behaviour (checked 2026-11-16)
6. [Chrome: declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — optional permissions and host permissions (checked 2026-11-16)
7. [Apple: Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions) — converting and running Safari extensions (checked 2026-11-16)
