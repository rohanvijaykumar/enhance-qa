---
module: offline-sync
kind: feature
title: Offline and sync
checked: 2026-11-16
---
# Offline and sync

Products that keep working without a network and sync later: PWAs and service workers, mobile apps with local databases, desktop apps with local files, "local-first" apps. Focus: queued writes, conflicts, reconnect, clocks, storage limits and caches. Live multi-user updates are in `realtime-collaboration.md`; settings storage in `settings-persistence.md`. Usually goes with `web-app.md`, a mobile module and `data-import-export.md`.

## Signals

- `manifest.webmanifest`, `navigator.serviceWorker.register`, Workbox, `vite-plugin-pwa`, `next-pwa`, `serwist`.
- Local stores: IndexedDB (`dexie`, `idb`, `RxDB`), `localStorage`, SQLite (`expo-sqlite`, `Room`, `Core Data`, `WatermelonDB`, `Realm`), PouchDB/CouchDB, `Replicache`, `ElectricSQL`, `PowerSync`, `TanStack Query` persisters.
- UI words: "offline", "sync", "pending", "last synced", "you're offline".

## Kickoff questions

1. What must work offline: read only, or create and edit too? (best guess: read cached data, queue writes)
2. Who can change the same data from other devices, and which side wins a conflict? (best guess: last write wins by server time, per field)
3. How much data is stored locally, and how long may a device stay offline? (best guess: a few thousand records, up to a week)

## Drivers

1. **Playwright with `context.setOffline(true)` and a service-worker-aware profile.** Best default for web. Toggle offline, act, go online, and observe. Playwright can inspect service workers (`context.serviceWorkers()`); disable them or clear storage between runs. Read storage via `page.evaluate`.
2. **Chrome DevTools Application panel through the browser tool.** Service Workers (offline, update on reload, bypass), Cache Storage, IndexedDB, Storage quota and "Clear site data". Lighthouse PWA/installability checks; Network throttling presets.
3. **HTTP client or mock server.** Make the server return 500, time out, reject with 409 or 412 to test the queue's retry and conflict path; record the exact requests the client replays.
4. **Local database inspection.** `sqlite3` on the app's database file (simulator or emulator container, desktop app data folder), IndexedDB viewers; confirm queued operations and sync metadata.
5. **Simulators and emulators.** Airplane mode through `adb shell cmd connectivity airplane-mode enable` (or the emulator's extended controls), `xcrun simctl` and the Network Link Conditioner for iOS; Android Studio and Xcode device storage settings.
6. **Fake clock.** Set the test machine's clock or inject a clock (Playwright `page.clock`) to test skew, expiries and time-based merges.

**Can't be driven here:** real cellular dead zones and handoffs, true low-storage device behavior (use emulator disk limits as a proxy, then a real low-storage device), OS background-sync scheduling on real phones and battery-saver rules, and Safari's PWA eviction on a real iPhone. These are device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | go offline, make one change, go online, change appears on the server and a second device |
| check | smoke, plus the changed data type, and conflict on the same record |
| full | operation (create, edit, delete) x connection (offline, flaky) x conflict x device |
| release | all of full, long-offline, storage pressure, clock skew, app update with queued data, human device tests |

Dimensions: operation, connection state (online, offline, flaky, captive portal), conflict (none, same field, delete vs edit), device count, offline duration (seconds, hours, days), storage state (plenty, near quota), app version (current, updated while queued).

## Check catalogue

### Offline behavior
- [high · agent] Load the app online, go offline, reload → the app shell loads from cache and shows cached data; a visible "offline" state appears {smoke}
- [high · agent] Open a page, route or record never visited while offline → a friendly "not available offline" message, not the browser's dinosaur or a blank page
- [medium · agent] Features that need the network (search on the server, payments, sign-in) → disabled or explained while offline; no endless spinner
- [medium · agent] Go offline in the middle of loading, mid-action, and during navigation → the app doesn't crash; partial loads are retried
- [medium · agent] Connection indicator → shows offline, back online, and syncing; accurate for flaky and captive-portal networks (online per the OS but no internet)
- [low · agent] Offline first launch (never opened before, no cache) → clear message that the first use needs a connection

### Queued writes
- [high · agent] Create, edit and delete items offline → each appears at once in the UI marked pending, and survives reload and app restart {smoke}
- [high · agent] Go online → queued operations replay in the original order, once each; items turn "synced"; the server state matches {smoke}
- [high · auto] Kill the app or tab while the queue is replaying, then reopen → no duplicates and no lost operations (idempotency keys per queued write)
- [medium · agent] Queued write that the server rejects (validation, permission removed, quota) → the user is told which item failed and why; failed items can be fixed, retried or discarded; the rest continue
- [medium · agent] Edits to an item created offline (it has no server ID yet) → merged into one create; temporary IDs are replaced everywhere, including links and child items
- [medium · agent] Delete then re-create, edit then delete, and many edits to one field offline → compacted or replayed correctly; end state equals what the user saw
- [medium · agent] Pending changes count and a "retry now" action → accurate; leaving the app with pending changes warns where the platform allows
- [medium · auto] Server returns 5xx or times out during replay → exponential backoff with a cap; the queue isn't dropped; no tight retry loop

### Conflicts
- [high · agent] Device A edits record X offline; device B edits X online; A reconnects → outcome follows the documented rule (last write wins, field merge, or prompt); never a silent, unexplained overwrite {smoke}
- [high · agent] A deletes offline while B edits the same record → the result is defined and shown (undelete, delete wins, or a prompt); no ghost record
- [medium · agent] Both edit different fields → both edits kept
- [medium · auto] Server version, ETag or `If-Match` checks (HTTP 409 or 412) → client handles the conflict; refetches and merges or prompts; verify with a replayed stale request
- [medium · agent] Conflict prompt (if any) → shows both versions clearly, and offers keep mine, keep theirs, merge; the choice is applied everywhere
- [medium · agent] Conflicting edits to lists, counters and text (increments, reorder, concatenation) → documented merge; counters add rather than overwrite where designed (CRDT or operation-based)
- [medium · agent] Permissions changed while offline (removed from the workspace, role downgraded) → queued writes are rejected cleanly on reconnect, and local copies are removed or locked as policy says {security}

### Sync after reconnect
- [high · agent] Reconnect after offline period → pulls remote changes; local and server data converge; the "last synced" time updates {smoke}
- [high · auto] Fresh sign-in on a second device → full initial sync completes; counts match the server; large data syncs in batches with progress
- [medium · agent] Interrupt sync (drop the network mid-way, kill the app) → resumes from a checkpoint; no duplicates and no re-download of everything
- [medium · agent] Deleted-on-server items → removed locally (tombstones); stay deleted after a later sync
- [medium · agent] Sync of large attachments and media → deferred until Wi-Fi if promised; progress and cancel available; doesn't block small data
- [medium · agent] Sign out while data is pending → warns that unsynced changes will be lost, or syncs first; local data of the previous user is cleared before the next user signs in {security}
- [medium · agent] Sync errors → shown with a retry; never an endless "syncing…" state

### Clock skew and time
- [high · agent] Set the device clock one day and one year ahead and behind, then edit offline and sync → ordering and last-write decisions use server time or logical clocks; no overwrite of newer data by an "older" device
- [medium · agent] Auth token expiry while offline for days → on reconnect, silent refresh or a sign-in prompt that keeps queued data
- [medium · agent] Time zone and DST change while offline → timestamps stay correct; due dates and reminders keep local meaning
- [medium · agent] Timestamps shown for pending items → show the local edit time; corrected after sync, with no "in the future" labels

### Storage limits and eviction
- [high · agent] Fill local storage near the quota (large cached data, test storage cap in DevTools or emulator) → writes fail with a clear message; the app doesn't corrupt data or crash; old cache is trimmed first
- [medium · agent] Browser storage eviction (clear site data, private window, WebKit's ITP rule that can clear script-writable storage after seven days of Safari use without user interaction, installed home-screen web apps exempt [9], low-space eviction) → the app detects missing cache and rebuilds from the server; queued unsynced data is protected (`navigator.storage.persist()` requested where it matters)
- [medium · agent] Schema change in local database with data present (app update) → local migration preserves queued writes and data; no blank app after update (see `data-import-export.md` for migrations)
- [medium · agent] Local data is cleared on sign-out and account deletion; sensitive data isn't stored unencrypted in `localStorage` or readable caches where the product claims privacy {security}
- [low · agent] Storage usage display and "clear offline data" action → accurate; clearing warns about unsynced changes

### Service workers and caches
- [high · agent] First visit, second visit, and visit after deploying a new version → new service worker installs; users get the new version after the documented flow (refresh prompt or next load); not stuck on the old version forever {smoke}
- [high · agent] Service worker update while a tab is open → no mix of old HTML with new JS (chunk 404s); "new version available" prompt works
- [medium · auto] Caching strategy per resource: app shell cache-first, API network-first or stale-while-revalidate, authenticated pages not cached for the next user → matches the design; private responses use `Cache-Control: private` or are never cached {security}
- [medium · agent] "Stale" data shown from cache → labeled or refreshed soon; a stale-while-revalidate view updates once fresh data arrives
- [medium · agent] Cache growth over time → old versions of caches are deleted on activate; storage doesn't grow without bound
- [medium · agent] Sign out → authenticated API caches are cleared; the next user doesn't see them offline {security}
- [medium · agent] Service worker scope and paths: deep links, `/sw.js` served with correct headers, no caching of the worker script itself for long → deep link works offline; updates aren't blocked
- [medium · auto] Lighthouse installability and offline checks / Workbox config → pass; manifest valid, icons right, `start_url` loads offline
- [low · agent] Background sync, periodic sync and push in the worker (where used) → fire on reconnect in Chromium; absent in Safari and Firefox is handled gracefully

## Gates

- Offline create, edit and delete replay once, in order, with no duplicates after interruption.
- Documented conflict rule works; no silent loss.
- New version of the app and service worker reaches users and doesn't strand queued data.
- Sign-out clears local private data.

## Human-only checks

- [human] On a real phone, enable airplane mode, use the app for 10 minutes, then reconnect → feels trustworthy; nothing lost; status messages clear
- [human] Use the app on a train or lift with real flaky coverage → no confusing half states
- [human] Install the PWA on iPhone Safari and Android Chrome, use offline after a day → still works, data intact
- [human] Judge conflict prompts with a non-technical user → can they pick the right version?

## Known pitfalls

- **Service worker caches hide changes.** A "bug" that vanishes after Application → Clear site data is often a stale cache; check "Update on reload" and report cache-busting issues only if real users would be stuck.
- **DevTools offline only blocks the page's network**, not requests from other contexts such as some workers; confirm with the Network panel.
- **`navigator.onLine` lies.** It says online on captive portals and dead Wi-Fi; judge by real requests.
- **Storage is per origin and per browser profile.** Test runs share nothing across contexts; stale state from earlier runs causes false failures; start each run clean.
- **Private windows** have small and temporary storage; failure there may be expected.
- **iOS Safari** evicts non-installed site storage after a period of non-use and has no background sync; compare to what the product claims.
- **Optimistic IDs** shown briefly (temp-123) are normal until sync.
- Test accounts and test servers only; don't take real customers' devices offline or sync real data.

## Sources

1. [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) — lifecycle, scope, updates (checked 2026-11-16)
2. [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — quota and eviction by browser (checked 2026-11-16)
3. [web.dev: Offline cookbook](https://web.dev/articles/offline-cookbook) — caching strategies (checked 2026-11-16)
4. [web.dev: PWA installability](https://web.dev/articles/install-criteria) — manifest and installability (checked 2026-11-16)
5. [Playwright: service workers and offline](https://playwright.dev/docs/service-workers) — testing with service workers; `setOffline` in [network docs](https://playwright.dev/docs/network) (checked 2026-11-16)
6. [Chrome DevTools: debug PWAs](https://developer.chrome.com/docs/devtools/progressive-web-apps) — Application panel (checked 2026-11-16)
7. [Android: airplane mode and connectivity from adb](https://developer.android.com/tools/adb) — adb shell commands (checked 2026-11-16)
8. [Local-first software (Ink & Switch)](https://www.inkandswitch.com/essay/local-first/) — conflict and sync expectations (checked 2026-11-16)
9. [WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) — 7-day cap on script-writable storage (checked 2026-11-16)
