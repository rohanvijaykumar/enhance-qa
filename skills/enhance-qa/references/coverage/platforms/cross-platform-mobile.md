---
module: cross-platform-mobile
kind: platform
title: Cross-platform mobile (React Native, Flutter, Expo)
checked: 2026-11-16
---
# Cross-platform mobile (React Native, Flutter, Expo)

Covers apps with one code base that ship to iOS and Android: React Native, Expo and Flutter. This module is about what differs between the two platforms, over-the-air (OTA) updates, native module gaps and the test drivers. It always goes with `ios.md` and `android.md`, which hold the platform checks, and with `../gates/apple-app-store.md` and `../gates/google-play.md`. It doesn't repeat those; it adds what a shared code base gets wrong.

## Signals

- `package.json` depends on `react-native` or `expo`; folders `ios/` and `android/`; `app.json` or `app.config.js` (Expo); `metro.config.js`; `eas.json`.
- `pubspec.yaml` with `flutter`; folders `lib/`, `ios/`, `android/`; `integration_test/`.
- README words: "React Native", "Expo", "Flutter", "EAS", "CodePush".

## Kickoff questions

1. Which targets ship (iOS, Android, web, desktop) and which framework version? (best guess: iOS and Android, versions from the lockfile)
2. Are there OTA updates (EAS Update, CodePush or similar) and custom native modules? (best guess: read `eas.json`, `expo-updates` and the native folders)
3. Is a Mac available for iOS runs? (best guess: Android emulator only if on Windows or Linux; iOS as a gap)

## Drivers

1. **The framework's own test runner for logic and widgets.** Jest with React Native Testing Library for React Native; `flutter test` for unit and widget tests. Cheap and deterministic; run first and record as baseline. These don't prove the native side works.
2. **Maestro.** Short YAML flows that run on iOS Simulator, Android emulator and real devices, framework-agnostic. Cheapest end-to-end driver for both frameworks. One flow can run on both platforms; add platform-specific steps where the UIs differ [1].
3. **Detox (React Native).** Gray-box end-to-end tests that wait for the app to be idle, which cuts flakiness. Needs a debug or release build on a simulator or emulator [2].
4. **Flutter `integration_test`.** Runs the app on a device or emulator with `flutter test integration_test`; Flutter Driver is the older approach [3].
5. **Platform tools** from `ios.md` and `android.md`: `adb`, `xcrun simctl`, `xcodebuild`, Gradle.
6. **Metro and Flutter DevTools** for logs, the widget tree and performance. Read `flutter analyze` and ESLint, `tsc --noEmit` output as static checks.

**Can't be driven here:** on Windows or Linux there's no iOS Simulator, so iOS runs become a gap or a device check unless a Mac or a cloud device service is available. Real-device checks (camera, biometrics, push, performance, battery) are device checks. Store submissions and OTA releases to production are human-only.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Android emulator (latest API) and, if a Mac exists, iOS Simulator (latest), debug build, main flow |
| check | smoke on both platforms, plus changed features on a small screen and in a release build |
| full | pairwise over platform × OS version × form factor × build type (debug, release) × theme × locale × permission state × OTA state |
| release | both platforms, release builds from the store pipeline, real device each, upgrade from the last release, OTA applied and rolled back |

Dimensions: platform; OS versions; phone and tablet; debug and release (release often behaves differently: minification, Hermes bytecode, tree-shaking, AOT in Flutter); new architecture on and off (React Native); embedded and downloaded JS bundle; OTA channel and runtime version; light and dark; language including RTL; permission state.

## Check catalogue

### Smoke
- [high · auto] Install dependencies from a clean checkout and build both platforms → installs from the lockfile and builds without errors {smoke}
- [high · auto] Run `tsc --noEmit` and ESLint (React Native) or `flutter analyze` (Flutter) plus the unit tests → pass or recorded as baseline {smoke}
- [high · agent] Launch the **release** build on each platform and run the main flow with Maestro → completes on both; no red screen, no crash {smoke}

### What differs between iOS and Android
- [high · agent] Run the same Maestro flow on both platforms and diff the result → same outcome; each difference is judged as intended (platform convention) or a bug
- [high · agent] Back navigation: Android system back and gesture vs iOS swipe-back and no back button → back works on every screen in both; modals and nested navigators close in the right order
- [high · agent] Permissions: ask for each permission on both → prompts differ (Android "only this time", "don't ask again"; iOS one-shot); both denied paths are handled; text strings exist for iOS purpose keys and Android manifest entries
- [medium · agent] Keyboard behaviour (avoid-view, resize vs pan, return-key types, hardware keyboard) → form fields stay visible on both; submit works
- [medium · agent] Safe areas and system bars (notch, Dynamic Island, camera cutout, gesture bar, status bar colour and icon style) → content isn't hidden; status bar text contrasts with the background in light and dark
- [medium · agent] Fonts and text rendering, line height and text clipping on both → the same layout within a small tolerance; custom fonts load on both; no clipped text at large font sizes
- [medium · agent] Platform-specific controls (date pickers, alerts, action sheets, switches, haptics) → each looks and behaves native enough or matches the stated design
- [medium · agent] Share sheet, file picker, camera and photo picker, open-in-browser, deep links → each works on both with the right file types and results
- [medium · agent] Status of push notifications on each: tokens, channels (Android) and categories (iOS), tap handling when app is killed → delivers and opens the right screen on both (use sandbox and test servers only)
- [medium · agent] Date, number and currency formatting, time zones and locale on both → matches the device locale on both; Hermes or JS engine `Intl` support differences don't produce wrong dates
- [low · agent] App icon, splash screen and adaptive icon on Android → correct on both platforms; no white flash on start; adaptive icon not cropped

### Native modules and platform gaps
- [high · auto] List every third-party and custom native module and check each supports both platforms and the current framework version → none is iOS-only or Android-only without a fallback; unsupported modules are listed as risks
- [high · agent] For each native feature (biometrics, camera, maps, in-app purchase, background tasks, notifications) → works on both, or the other platform shows a clear message; the JS side doesn't crash when a module returns nothing
- [high · agent] Call a missing or unavailable native API on purpose (permission denied, hardware absent, old OS) → returns an error the app handles; no red screen
- [medium · auto] Check `expo doctor` (Expo) or `flutter doctor -v` and dependency version alignment → no mismatched SDK versions or unsupported packages
- [medium · agent] Expo Go vs a development or release build → features that need custom native code work in the development build; don't rely on Expo Go results for them
- [medium · agent] Autolinking and pods/Gradle: clean build (`pod install`, `./gradlew clean`) → builds from scratch; no hand-edited native files that are lost on regenerate (prebuild)
- [medium · agent] New architecture or Impeller/Skia renderer flags (as used) → the main flows pass with the shipping setting; rendering differences are checked on both
- [medium · agent] Web or desktop target if claimed → the shared code runs there, or unsupported features show a message

### OTA updates (EAS Update, CodePush or similar)
- [high · auto] Check the runtime version or update channel matches the native build (`app.json` `runtimeVersion`, `eas.json` channel) → an update only reaches builds with compatible native code [4]
- [high · agent] Publish an update to a test channel; launch a test build → it downloads, applies on the next launch (or as configured), and the app shows the new behaviour
- [high · agent] Publish a deliberately broken update to the test channel → the app rolls back or can be reverted by republishing; it doesn't brick on every launch (embedded bundle fallback works)
- [high · agent] Update that needs a new native module or permission → blocked or flagged; an OTA must not ship JS that calls native code absent from installed builds
- [medium · agent] Install on a device offline, then online; slow network during download; interrupted download → starts from the embedded bundle; no corrupt half-update
- [medium · agent] Update checks on launch vs in the background; user-visible reload prompts → the behaviour matches what the docs promise; no surprise reload mid-task
- [medium · human] Check store rules on downloaded code → updates change JS and assets only, not the app's main purpose (see the gate packs); the user decides if a change is too big for OTA [5]
- [medium · auto] Check code signing of updates and channel access control → only the team can publish to production; secrets not in the app {security}
- [medium · agent] Staged rollout and rollback (as supported) → a percentage rollout reaches only part of the test devices; rollback returns to the previous update
- [low · agent] CodePush users: confirm the service the project uses is still available → App Center's retirement means a self-hosted or other service may be in use; check before relying on it [6]

### Release builds and performance
- [high · agent] Compare debug and release behaviour of the main flow → release has no dev-only code paths (dev menus, `__DEV__` flags, verbose logs, debug banner)
- [high · auto] Check that release builds are minified/obfuscated as intended and crash symbolication works (source maps or `--split-debug-info` symbols uploaded) → a test crash shows readable frames in the crash tool
- [medium · agent] Scroll the longest list and run the heaviest screen in release on a mid-range device → no dropped frames; no memory growth; JS thread not blocked
- [medium · agent] Cold start time in release on both platforms → recorded; large regressions against the last release flagged
- [medium · auto] Bundle and app size against the last release → no unexplained jump (for example an asset or large dependency added)
- [medium · agent] Console, Metro and native logs during the main flow → no unhandled promise rejections, warnings that matter, or native exceptions

### Accessibility
- [high · agent] Label every touchable (`accessibilityLabel` or `Semantics`) and check roles and states on both → VoiceOver and TalkBack both announce each control; icon-only buttons have names {a11y}
- [medium · agent] Largest font size on both platforms → text scales (check `allowFontScaling` and `maxFontSizeMultiplier` choices); no clipped controls {a11y}
- [medium · device] Screen-reader pass on one real device per platform → the main task is possible by sound alone {a11y}

### Security and data
- [high · auto] Search the JS bundle (`index.android.bundle`, `main.jsbundle`, Flutter snapshot strings) for keys, tokens and secrets → none found; public client ids only {security}
- [medium · agent] Token storage → in Keychain and Keystore (via secure-store or equivalent), not AsyncStorage, SharedPreferences or plain files {security}
- [medium · agent] Deep link handling in the JS router on both platforms → hostile parameters rejected; auth guard applies {security}
- [medium · agent] Network security: HTTPS only, certificate pinning if claimed, behaviour on proxy/untrusted certificate → fails safe

### Test driver hygiene
- [medium · auto] Run the Maestro, Detox or integration_test suite 3 times → same result each time; any flaky test is recorded n/3 and quarantined, not ignored
- [low · auto] Test selectors → use stable ids (`testID` or `Key`) and not text that changes with locale

## Gates

- `../gates/apple-app-store.md` and `../gates/google-play.md` for both stores; `ios.md` and `android.md` for the platform checks.
- Release blockers specific to shared code bases: a platform-specific module with no fallback, OTA update incompatible with installed native code, debug code in release, missing crash symbols, one store's required strings or entitlements missing.

## Human-only checks

- [human] On one real iPhone and one real Android phone, run the main task from the store-pipeline build → same flow works on both; nothing feels foreign to the platform
- [human] Publish a test OTA update to an internal channel and watch a phone pick it up and roll back → behaves as expected
- [human] Use VoiceOver and TalkBack for the main task → doable on both
- [human] Judge platform feel (navigation, haptics, sheets, text) on both → acceptable to the user for each platform
- [human] Submit to both stores and approve production OTA releases → an agent never does

## Known pitfalls

- **Debug and release differ.** A bug that appears only in release (or only in debug) is real information; say which build.
- **Expo Go isn't the shipping app.** Missing native modules in Expo Go are expected.
- **Flutter on the iOS Simulator** uses a different renderer path than a device for some effects; check a device before filing visual glitches.
- **Dev menus, red boxes and yellow warnings** appear in debug builds only; don't file them against release.
- **Metro and Gradle first builds are slow** and often print warnings; judge the app, not the build log noise.
- **Hot reload leaves stale state.** Do a full restart before filing a state bug.
- **Detox and Appium flakiness** is often timing; use idle-wait features and retry once before filing.
- **Android back vs iOS swipe** differences are conventions, not bugs, if the app follows each platform's convention.
- **OTA tests never go to production.** Use a test channel, test build and test devices; the production channel is read-only for an agent.

## Sources

1. [Maestro documentation](https://docs.maestro.dev/) — flows for iOS, Android and cross-platform frameworks (checked 2026-11-16)
2. [Detox documentation](https://wix.github.io/Detox/) — gray-box end-to-end tests for React Native (checked 2026-11-16)
3. [Flutter: Integration tests](https://docs.flutter.dev/testing/integration-tests) — `integration_test` package and running on devices (checked 2026-11-16)
4. [Expo: EAS Update](https://docs.expo.dev/eas-update/introduction/) — channels, runtime versions, updates only change JS and assets (checked 2026-11-16)
5. [Apple: App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — rules on downloaded code and app purpose; read the current text for exact wording (checked 2026-11-16)
6. [Microsoft: Visual Studio App Center retirement](https://learn.microsoft.com/en-us/appcenter/retirement) — App Center, which hosted CodePush, was retired (checked 2026-11-16)
7. [React Native: Testing overview](https://reactnative.dev/docs/testing-overview) — unit, component and end-to-end test levels (checked 2026-11-16)
