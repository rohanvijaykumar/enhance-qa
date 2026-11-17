---
module: settings-persistence
kind: feature
title: Settings and persistence
checked: 2026-11-16
---
# Settings and persistence

Covers user preferences and saved state: that every setting persists where the product promises (restart, devices, reinstall), that defaults and reset work, that old settings migrate after updates, and that invalid or corrupt stored values don't break the product. Goes with `onboarding.md`, `offline-sync.md`, `installers-updaters.md`, `accounts-auth.md` and `data-import-export.md`.

## Signals

- A settings, preferences or options screen; theme, language, notification, privacy, shortcut or layout controls.
- Storage code: `localStorage`, `IndexedDB`, cookies, `UserDefaults`, `SharedPreferences`, `DataStore`, Electron `electron-store`, `config.json`/`settings.ini`/registry keys, `appdata` folders, a `user_settings` table, cloud sync of preferences.
- Schema or version fields in stored data (`settingsVersion`, migrations).
- README promises like "your settings sync across devices" or "remembers your last view".

## Kickoff questions

1. Where are settings stored (local file, browser, server account, cloud) and which settings are meant to sync across devices? (best guess: read from the code; synced if tied to an account)
2. Which settings survive uninstall or reinstall by design? (best guess: none for local; all for account-based)
3. Which previous version(s) should upgrade cleanly? (best guess: the last release)

## Drivers

1. **Storage inspection plus restart loop.** Change a setting through the UI, read the storage directly (`page.evaluate(() => localStorage)`, `context.storageState()`, `adb shell run-as <package> cat shared_prefs/*.xml`, `xcrun simctl get_app_container ... data` then read plist/JSON, the config file on disk, the DB row), then restart and compare. The core driver; cheap and exact.
2. **Playwright with persistent contexts.** `launchPersistentContext(userDataDir)` to restart a web session with its storage intact; `storageState` to clone it; a second context for "another device".
3. **Platform state controls.** `adb shell pm clear`, `adb backup`-style tools where allowed, `xcrun simctl uninstall/install`, `defaults read/write` (macOS), registry export (`reg query`) and `Get-ItemProperty` (Windows), `dconf dump` (Linux).
4. **Fixture builders for old and bad data.** Scripts that write an old-version settings file, a partial file, a corrupt JSON file, wrong types and out-of-range values directly to storage.
5. **Two-account or two-device simulation.** Two Playwright contexts or two emulators signed into the same test account.
6. **Install of previous builds.** Previous release artefacts from the repo's releases or store test tracks, installed first, then upgraded in place.

**Can't be driven here:** real cloud sync timing across real devices over days, OS-level backup/restore (iCloud, Google backup, Time Machine) on real hardware, and reinstall behaviour on a real phone through the store. These become device or human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Change one setting of each type, restart, confirm it stuck |
| check | Smoke, plus reset to defaults, plus the changed settings from the current diff |
| full | Every setting × (change, restart, new session or device, reset) × state (fresh, upgraded from previous version, corrupt storage) |
| release | Full, plus reinstall and cross-device, plus upgrade from each supported old version |

Dimensions: setting, storage scope (device, account, workspace), lifecycle (restart, logout/login, update, reinstall, second device), data validity (valid, missing, wrong type, out of range, corrupt), platform.

## Check catalogue

### Persistence across restart and sessions
- [high · agent] Change every setting (toggle, dropdown, slider, text, theme, language, layout, shortcut), then close and reopen the product (reload, kill process, reboot where cheap) → each value is still what was set; the UI shows it, and the behaviour actually changed {smoke}
- [high · agent] Read the underlying storage after each change → the value is written immediately or at a defined moment (not only on a clean exit); killing the process right after a change keeps it
- [medium · agent] Change a setting and close the window or tab fast (before debounce or autosave) → saved, or the product warns about unsaved changes
- [medium · agent] Log out and back in as the same user on the same device → account-level settings are restored; device-level ones as documented
- [medium · agent] Two tabs or windows changing the same setting → the last change wins and the other view updates or shows the new value on refresh; no silent revert from a stale tab
- [medium · agent] Settings that apply at once vs on "Save" → the UI makes it clear; Cancel discards and restores the previous values; navigating away asks about unsaved changes
- [medium · agent] Settings that need a restart (hardware acceleration, language on some platforms) → say so; after restart they apply
- [medium · agent] Persisted view state: last tab, sort order, filters, column widths, window size and position, scroll position, collapsed panels, last-opened document → restored if promised; restored to a visible place when the monitor layout changed (off-screen windows are brought back)

### Defaults and reset
- [high · agent] First run: read every setting's default → matches the documented default, is sensible (safe, private and accessible: notifications and tracking opt-in where the law needs it) {smoke}
- [high · agent] "Reset to defaults" (or per-section reset) → every setting returns to its default, in the UI and in storage; the product behaviour matches; the confirmation names what will be lost
- [medium · agent] Reset doesn't touch what it shouldn't (account data, content, credentials, licence keys) unless it says so
- [medium · agent] Delete the settings file or clear storage by hand → the product starts with defaults and recreates the file; no crash, no stuck onboarding for an existing account
- [medium · agent] Defaults after a new feature adds a setting → the new setting has a default; existing users get it without a crash
- [medium · agent] Locale-dependent defaults (units, date format, language) follow the OS or browser on first run and then stay as chosen (see `i18n-rtl.md`)

### Scope: device, account, workspace and cloud
- [high · agent] For each setting, test the scope the product claims: device only (stays on this device), account (follows the user), workspace (shared with the team) → matches the claim; a team-wide setting needs the right role to change {smoke}
- [high · agent] Account-level settings on a second device or second browser context for the same test account → appear within the stated sync time; device-specific ones (window size, local paths, hardware options) don't sync
- [medium · agent] Two devices change different settings while offline, then reconnect → both changes survive (merge per setting) or a conflict message appears; nothing silently lost (see `offline-sync.md`)
- [medium · agent] Two devices change the same setting while offline → a documented rule (last write wins by time) holds; clock skew doesn't flip the result
- [medium · agent] A different user logs in on the same device (shared computer) → they get their own settings, not the previous user's; nothing private from user A shows
- [medium · agent] Guest or logged-out settings → saved locally and merged or discarded sensibly at login
- [medium · agent] Role change or removed from a workspace → workspace settings that the user could change before are now read-only or hidden

### Reinstall and backup
- [high · device] Uninstall and reinstall (or clear app data) → local settings reset to defaults unless the product promises otherwise; account settings return after sign-in; no leftover state that breaks the fresh install {smoke}
- [medium · device] OS backup and restore or device migration (iCloud, Google Auto Backup, Time Machine, Windows backup) → state restored or excluded as the product intends; secrets and tokens are not restored where they shouldn't be (Android `allowBackup`, Keychain flags)
- [medium · agent] Export and import settings, where offered → round-trip gives identical settings; a settings file from another version or user is validated before apply
- [medium · agent] Portable or multi-profile installs → each profile has its own settings

### Migration after updates
- [high · agent] Install the previous release with non-default settings; upgrade in place → every setting carries over with the same meaning; none reset to default without a reason {smoke}
- [high · agent] Upgrade across several versions (oldest supported to current) → migrations run in order; the final data is correct; the stored version number is updated
- [medium · agent] Renamed, removed or re-typed settings (a boolean became an enum) → old values map to sensible new ones; removed ones are ignored, not crashes
- [medium · agent] Downgrade to the old version after upgrading → the old version either works with the new data or says clearly that it can't; it must not overwrite the new data with damaged settings
- [medium · agent] Interrupted migration (kill the process mid-migration) → next launch recovers; a backup of the old settings exists or the migration is atomic
- [medium · agent] Migration of settings stored on the server vs the client at different times (old client with new server and the reverse) → neither breaks; unknown fields are preserved
- [low · agent] Migration performance on a large settings or profile set → completes in reasonable time with progress if long

### Invalid, missing and corrupt stored values
- [high · agent] Corrupt the settings file or storage (truncated JSON, empty file, binary junk, wrong encoding, a BOM) → the product starts, falls back to defaults (and keeps a copy of the bad file or tells the user), and doesn't crash-loop {smoke}
- [high · agent] Wrong types and impossible values written directly (a string for a number, `-1` for a width, `9999` for a zoom, `null`, an unknown enum value, an unknown language code, a future date) → validated and replaced by the default or clamped; no crash, no layout broken beyond use
- [medium · agent] Missing keys (an old file without new settings) → defaults fill in; the file isn't rewritten with garbage
- [medium · agent] Extra unknown keys from a newer version → preserved or ignored without errors
- [medium · agent] File permissions: read-only settings file, full disk, missing directory, locked file (another instance) → handled message, no data loss, the app keeps running with in-memory values
- [medium · agent] Very large stored values (a 5 MB string, 10,000 items in a list setting) → handled without a hang; a quota error on browser storage is caught
- [medium · agent] Browser storage cleared, blocked (private mode, third-party cookies off) or quota-exceeded → the web app works with defaults and says so if persistence is unavailable
- [medium · agent] Concurrent instances writing settings → no corruption; the last writer wins cleanly
- [medium · agent] Stored values that include injection text (`<script>`, `'; DROP`) → displayed as text, never executed {security}
- [medium · agent] Stored secrets (API keys, tokens) → kept in the OS keychain, secure store or encrypted, not in plain text in a settings file or `localStorage` (see `security.md`) {security}

### Individual setting types
- [high · agent] Theme (light, dark, system) → applies instantly, persists, follows the OS when set to system, and doesn't flash the wrong theme on load
- [high · agent] Language and region → persists and applies to all screens, including after restart (see `i18n-rtl.md`)
- [medium · agent] Notification and privacy settings → each toggle really controls the thing (turn off email notifications, then trigger the event, then check the catcher is empty) (see `notifications.md`, `privacy-consent.md`)
- [medium · agent] Keyboard shortcut customisation → conflicts detected; resets work; shortcuts persist and work after restart
- [medium · agent] Numeric and text settings with bounds → validation message on bad input; boundary values (min, max, min-1, max+1) behave
- [medium · agent] Dependent settings (enabling A disables B) → the disabled state is shown and persisted consistently; turning A off again restores B's earlier value if designed so
- [medium · agent] Per-item or per-project settings → stay with the item when it's copied, exported or moved
- [low · agent] Accessibility settings (text size, reduced motion, contrast) → persist and apply on all screens (see `accessibility.md`)

## Gates

- Account-level data persistence and deletion interplay with privacy rights: see `privacy-consent.md`.
- Store and installer gates check that uninstall and update keep or remove user data as declared; see `installers-updaters.md`.

## Human-only checks

- [human] Set the product up exactly the way you like it, use it for a day, then update and reinstall on your real device → everything is as you left it, or the product told you what changed.
- [human] On two real devices with one real account (a test account of your own), change settings on each → they sync in a time that feels right.
- [human] Judge whether the defaults feel right for a new user (privacy, notifications, sound, size).
- [human] Check that the wording of reset and migration messages is clear and not alarming.

## Known pitfalls

- **Debounced saves.** A setting written 500 ms after the change looks "not saved" if you kill the process immediately; check the product's stated behaviour first, then report if data is lost.
- **Hot reload and dev builds** may clear or recreate storage; test on the production build.
- **Private browsing and automation profiles** discard storage on close by design; use a persistent context.
- **Sync delay isn't a failure.** Compare with the stated sync time; retry once before filing.
- **Android and iOS clear app data differently** from uninstall; name which one you did.
- **OS-managed values (dark mode, locale, reduced motion)** can't be "saved" by the app; the app must follow them.
- **Don't edit storage on a real user's device.** Use test profiles, emulators and fixtures only.
- **A default that differs from the docs** may be a doc bug; file it as a question with both sources.

## Sources

1. [MDN: Web Storage API and storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) — browser storage limits and clearing (checked 2026-11-16)
2. [Playwright: Authentication and storage state](https://playwright.dev/docs/auth) — saving and reusing browser state, persistent contexts (checked 2026-11-16)
3. [Android: Data and file storage overview](https://developer.android.com/training/data-storage) — app data, backup behaviour (checked 2026-11-16)
4. [Apple: UserDefaults](https://developer.apple.com/documentation/foundation/userdefaults) — preferences storage on Apple platforms (checked 2026-11-16)
5. [ISTQB CTFL v4.0.1, §2.3 Maintenance testing](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf) — migrations with data conversion (checked 2026-11-16)
