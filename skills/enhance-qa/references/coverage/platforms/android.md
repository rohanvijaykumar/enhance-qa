---
module: android
kind: platform
title: Android apps
checked: 2026-11-16
---
# Android apps

Covers native Android apps (Kotlin, Java, Jetpack Compose, Views) on phones and tablets, with notes for foldables, Wear OS and Android Auto. It covers emulator and device testing, fragmentation, back navigation, permissions, process death, configuration changes and battery limits. Cross-platform frameworks add `cross-platform-mobile.md`. Play policy is in `../gates/google-play.md`. It goes with `../features/notifications.md`, `../features/payments-subscriptions.md`, `../features/accessibility.md`, `../features/privacy-consent.md` and `../features/camera-mic-sensors.md`.

## Signals

- `build.gradle` or `build.gradle.kts` with `com.android.application`; `AndroidManifest.xml`; `app/src/main`; `*.kt` or `*.java` files; `gradlew`.
- `google-services.json`, `proguard-rules.pro`, a `fastlane/` folder with `supply`.
- README words: "Android", "APK", "AAB", "Google Play", "Jetpack Compose".

## Kickoff questions

1. Which Android versions and form factors must it support (phones only, tablets, foldables, Wear OS)? (best guess: `minSdk` from Gradle, phones plus tablets if the manifest allows it)
2. Does it use push, in-app billing, background work or location? (best guess: read the manifest permissions and dependencies)
3. Is there an emulator or a real device on this machine, and a test backend and account? (best guess: emulator only, seeded test account)

## Drivers

1. **Gradle tests.** `./gradlew test` for unit tests, `./gradlew connectedAndroidTest` for instrumented tests (Espresso, Compose UI test, UI Automator) on an emulator or device. Read the XML reports and the `adb logcat` output, not screenshots.
2. **`adb`.** The shell driver for everything the emulator and a device share [1]: `adb install -r`, `adb shell am start`, `am start -a android.intent.action.VIEW -d <url>` for deep links, `pm grant` and `pm revoke` for permissions, `pm clear`, `input tap/text/keyevent`, `settings put system font_scale`, `cmd uimode night yes`, `wm size` and `wm density`, `dumpsys` for state, `adb logcat -b crash` for crashes, `adb exec-out screencap -p` for screenshots.
3. **Maestro or Appium (UiAutomator2).** Flows outside the app project. Maestro YAML is cheap; Appium is heavier. Both run on emulator and device.
4. **UI Automator dump** (`adb shell uiautomator dump`) for a cheap text view of the screen, scoped by resource id, before reaching for screenshots.
5. **Android Studio tools and CLI:** Lint (`./gradlew lint`), StrictMode, Macrobenchmark and Baseline Profiles, LeakCanary in debug builds, `bundletool` for AAB testing, `apkanalyzer` for size and manifest.
6. **Firebase Test Lab or Play pre-launch report** for a device spread, if the user has a project for it. These use real cloud devices and need the user's account (human to set up).

**Can't be driven here:** the emulator can't provide real sensors in motion, biometrics, NFC, real cellular behaviour, accurate battery, thermal and Doze timing on OEM builds, camera quality, or OEM skin quirks (Samsung, Xiaomi, Oppo, etc.). These are device checks. Real Play Store purchase flows and store submission are human-only. On Windows the emulator needs virtualisation enabled (Hyper-V or the Android Emulator hypervisor); if absent, report it as a gap.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | latest stable API level, one Pixel-class phone emulator, light mode, English, fresh install |
| check | smoke, plus the minimum `minSdk` emulator, plus changed features on a small screen and with large font |
| full | pairwise over API level (minSdk, a middle one, latest, preview) × form factor (small phone, large phone, tablet, foldable) × font scale × theme × locale and RTL × permission state × network × battery saver |
| release | full, plus at least two real devices from different makers, release (minified) build, upgrade from the last release |

Dimensions: API level; screen size and density; OEM skin; display cutout; gesture vs 3-button navigation; font scale and display size; light, dark and dynamic colour; language including RTL; permission state (not asked, allowed, denied, denied permanently, "only this time"); network (Wi-Fi, cellular, offline, IPv6-only); battery saver.

## Check catalogue

### Smoke
- [high · auto] `./gradlew assembleDebug test lint` → builds, tests pass, no new lint errors {smoke}
- [high · agent] Install the debug build on a fresh emulator, launch, pass onboarding → main screen shows; `adb logcat -b crash` is empty {smoke}
- [high · agent] Do the main task, force-stop (`am force-stop`), relaunch → the result persists {smoke}

### Install, launch and upgrade
- [high · agent] Cold start 5 times (`am start -W`) → starts to a usable screen each time; record startup time; no ANR dialog
- [high · device] Install the previous release, add data, update with the new build → data and settings migrate; no crash on first launch
- [medium · auto] Install the release AAB through `bundletool` or the release APK (minified, shrunk) → the app runs the main flow; no `ClassNotFoundException`, missing reflection or serialization bug from R8 or ProGuard
- [medium · agent] Uninstall and reinstall → fresh state; cloud backup restore doesn't bring back a broken state (`android:allowBackup` and backup rules match intent)
- [medium · auto] `apkanalyzer manifest print` → only intended permissions; `android:exported` set explicitly on every component with an intent filter; target SDK meets the current Play requirement (see gate pack) {security}

### Back navigation, tasks and intents
- [high · agent] Press system Back and use the back gesture on every screen and dialog → returns to the expected previous screen; at the root, the app exits or goes home as designed; no loop [2]
- [medium · agent] Predictive back animation where supported (Android 13+ with the setting on) → back preview doesn't break the screen or lose state
- [medium · agent] Open the app from a notification, a deep link, a share intent and the launcher while it is already running → one task, correct screen, correct back stack
- [medium · agent] Use Recents: switch away and back, swipe the app away, reopen → state restored or clean start, no crash
- [medium · agent] Rotate or fold with a dialog, a bottom sheet and a keyboard open → they stay open or close cleanly; text typed isn't lost

### Process death and configuration changes
- [high · agent] Enable "Don't keep activities" in developer options (or `adb shell am kill <pkg>` after backgrounding), return to the app mid-flow → the screen restores its state (form text, scroll, selected item) or restarts to a safe screen; no crash, no blank screen [3]
- [high · agent] Rotate on each screen; change language, font scale, dark mode and display size while the app is open → state kept; no crash; no duplicated network calls; no lost input [4]
- [medium · agent] Split-screen, pop-up window and freeform windows on tablet or desktop mode → layout adapts; the app doesn't assume full screen; `resizeableActivity` as declared
- [medium · agent] Start a long task (upload, download, payment screen), background, kill the process → the task resumes, retries or reports failure; no half state
- [medium · agent] Low memory (`am send-trim-memory`) with heavy screens → no crash; caches are released

### Permissions
- [high · agent] For each runtime permission (camera, mic, location, notifications on Android 13+, photos and media, contacts, Bluetooth): allow, deny, deny twice ("don't ask again"), allow "only this time", revoke in Settings while running → app handles every state, explains and offers a Settings link; no crash
- [high · auto] Compare manifest permissions to code use → none unused or over-broad (for example background location, SMS, all-files access) without a stated need {security}
- [medium · agent] Auto-reset: an unused app has permissions revoked → the app asks again when needed
- [medium · agent] Photo picker instead of broad storage access → works without storage permission on current Android
- [medium · agent] Foreground service types and notifications → each service declares a type and shows its notification; the app doesn't crash when starting one from the background

### Battery, Doze and background work
- [high · agent] Force Doze (`adb shell dumpsys deviceidle force-idle`) and App Standby (`am set-inactive <pkg> true`), then check scheduled work, alarms and push → the app behaves as designed; deferred work runs after exit from Doze; high-priority push still arrives [5]
- [medium · agent] WorkManager jobs under constraints (no network, low battery, charging) → run when constraints are met; retries back off; no duplicate runs
- [medium · agent] Battery saver on → app still works; background sync reduced as designed
- [medium · device] Exact alarms and background restrictions (OEM "battery optimisation", "restricted" bucket) → reminders and sync still work, or the app explains what to enable
- [medium · device] Leave the app idle overnight with notifications on → battery use in Settings is modest; no wakelock held (`dumpsys batterystats`)

### Fragmentation (API levels, screen sizes, OEM skins)
- [high · agent] Run the main flow on `minSdk`, a middle API level and the latest → no `NoSuchMethodError`, no crash from newer APIs on older versions
- [medium · agent] Test on small phone (360 dp wide), large phone, tablet, and unfolded foldable emulator → layout uses available width (list-detail on large screens); no stretched phone UI; touch targets fine [6]
- [medium · agent] Display cutouts, edge-to-edge and system bars, 3-button and gesture navigation → content isn't hidden behind bars; insets handled
- [medium · agent] Font scale up to the largest and display size to the largest → text scales; no clipped buttons {a11y}
- [medium · device] Samsung, Xiaomi or other OEM device: sign-in, notifications, background work, file picker, share → works; OEM-specific permission screens are explained to the user
- [medium · agent] Locale changes including a 12/24-hour clock, RTL (force RTL in developer options) and a non-Latin language → layout mirrors; formats correct

### Accessibility
- [high · agent] Run the Accessibility Scanner or Espresso accessibility checks on main screens → no unexplained issues; content descriptions on icon-only buttons {a11y}
- [medium · agent] Touch targets at least 48 dp; sufficient contrast; no information by colour alone → meets the guidance {a11y} [7]
- [medium · device] TalkBack on a device: sign in and the main task → each element announced; focus order logical; custom views expose roles and states {a11y}
- [medium · agent] Switch Access or keyboard (`adb shell input keyevent KEYCODE_TAB`) → every control reachable; visible focus {a11y}

### Deep links and App Links
- [high · agent] `adb shell am start -a android.intent.action.VIEW -d "<url>" <pkg>` for each documented link, app running and killed → the right screen opens
- [high · auto] Fetch `https://<domain>/.well-known/assetlinks.json` → valid JSON, correct package name and signing certificate fingerprint; `adb shell pm get-app-links <pkg>` shows verified domains (verification can take time on a new install) [8]
- [medium · agent] Hostile and malformed link parameters → rejected or sanitised; no crash; no action without confirmation {security}
- [medium · agent] Exported components and intent filters → can't be abused to bypass sign-in (test with `am start -n <component>` from `adb`) {security}

### Notifications and billing (test modes only)
- [high · agent] Push on the emulator with Google APIs, using a test message from the FCM console or a test server key → notification arrives; tap opens the right screen; channels exist with sensible names and importance
- [medium · agent] Notification permission denied (Android 13+) → app explains; no crash; settings link works
- [medium · agent] Notification channels: the user turns one off → the app respects it and doesn't re-create it as noisy
- [high · agent] Play Billing with license testers and test cards (always approve, always decline, slow card) → each outcome handled; entitlement granted only after acknowledge; accelerated renewals behave as set [9]
- [medium · agent] Unacknowledged test purchases are refunded after a few minutes → the app acknowledges promptly and retries if it fails
- [high · human] Real-money purchase → never done by an agent

### Data, security and storage
- [high · auto] `./gradlew lint` plus a secrets scan on source, `strings.xml` and the APK → no keys, tokens or passwords in plaintext {security}
- [medium · agent] `adb logcat` during login and payment → no tokens, emails or card data in logs {security}
- [medium · agent] Cleartext traffic and certificate handling → HTTPS only (`usesCleartextTraffic` false unless justified); no trust-all certificate code {security}
- [medium · agent] Check stored tokens and files → tokens in encrypted storage or Keystore; no sensitive data in shared storage {security}
- [medium · agent] Backup and restore, and device-to-device transfer → the user data is restored correctly, secrets excluded as intended
- [medium · agent] Screen capture and Recents thumbnail on sensitive screens → hidden with `FLAG_SECURE` if promised

### Performance and stability
- [high · auto] StrictMode on in debug while running the main flow → no disk or network on the main thread; no leaked closables
- [medium · agent] Scroll the longest list and open heavy screens repeatedly → no jank (frames stay near 16 ms for 60 Hz), no memory growth, no ANR (keep the main thread free for 5 seconds)
- [medium · agent] Weak network and offline mode (emulator network speed, airplane mode) → loading, error and retry states; no crash on timeouts
- [medium · device] Cold start and jank on a low-end real device → acceptable; Android vitals thresholds are the production yardstick (crash and ANR rates) [10]

### Wear OS and Android Auto notes
- [medium · agent] Wear OS: run on the Wear emulator paired with a phone emulator; test tiles, complications, notifications and data sync → works with the phone out of range if claimed; round and square screens; ambient mode
- [medium · device] Android Auto: test with the Desktop Head Unit (DHU) and then a real car → only supported app categories and templates; no distracting UI; media and navigation controls work

## Gates

- `../gates/google-play.md` for Play policy, Data safety, target API level, pre-launch report and testing tracks.
- Release blockers specific to Android: crash or ANR on launch on `minSdk`, minified release build failing the main flow, missing or over-broad permissions, `exported` not set, target API level below the Play requirement, unacknowledged purchases.

## Human-only checks

- [human] Install the release build from the internal testing track on your own phone and use the main task for 10 minutes → no crash; it feels responsive
- [human] Turn on TalkBack and complete sign-in plus the main task → everything is announced and doable
- [human] Use the app on a second maker's phone (Samsung or another) → battery, permission and notification screens behave
- [human] Make a Play test purchase with a licence-tester account → access granted, restore works, no real charge
- [human] Submit through Play Console → follow the gate pack; an agent never submits

## Known pitfalls

- **Emulator isn't a phone.** No real battery, OEM skin, sensors in motion or camera quality. Don't file "slow" from an emulator without a device check.
- **Debug builds are slow and noisy.** Debuggable apps are slower; Compose layout inspector and StrictMode logs aren't release bugs.
- **Google Play Services missing.** Emulator images without Google APIs fail push, maps and sign-in; that's the image, not the app.
- **App Links verification delay.** A freshly installed or updated app can take time before domains verify; retry with `pm verify-app-links` before filing [8].
- **Doze and OEM restrictions** differ by device; a missed background job on one OEM isn't a bug in the code unless it is documented to work.
- **First install runs slower** (dexopt); measure later launches.
- **Intermittent ANR in CI** is often the emulator under load; retry and record n/N.
- **logcat noise.** System, vendor and Play Services lines (`W/System`, `E/GoogleApiManager`) aren't app bugs; filter on the package.
- **Never use a real Google account, real card or production backend.** Test accounts and licence testers only.

## Sources

1. [Android: Android Debug Bridge (adb)](https://developer.android.com/tools/adb) — shell commands, install, logcat (checked 2026-11-16)
2. [Android: Predictive back gesture](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture) — back navigation behaviour (checked 2026-11-16)
3. [Android: Activity lifecycle and state changes](https://developer.android.com/guide/components/activities/state-changes) — process death and state saving (checked 2026-11-16)
4. [Android: Handle configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes) — rotation, language, font scale (checked 2026-11-16)
5. [Android: Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby) — forcing idle with `dumpsys deviceidle` and `am set-inactive` (checked 2026-11-16)
6. [Android: Large screen app quality](https://developer.android.com/docs/quality-guidelines/large-screen-app-quality) — tablets, foldables, window sizes (checked 2026-11-16)
7. [Android: Core app quality](https://developer.android.com/docs/quality-guidelines/core-app-quality) — lifecycle, accessibility, performance, permissions tests (checked 2026-11-16)
8. [Android: Verify App Links](https://developer.android.com/training/app-links/verify-applinks) — `assetlinks.json`, `pm verify-app-links`, `pm get-app-links`, verification delay (checked 2026-11-16)
9. [Android: Test Google Play Billing](https://developer.android.com/google/play/billing/test) — licence testers, test instruments, accelerated renewals (checked 2026-11-16)
10. [Android: Android vitals](https://developer.android.com/topic/performance/vitals) — crash and ANR bad-behaviour thresholds (checked 2026-11-16)
