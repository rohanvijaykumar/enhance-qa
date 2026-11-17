---
module: ios
kind: platform
title: iOS and iPadOS apps
checked: 2026-11-16
---
# iOS and iPadOS apps

Covers native iPhone and iPad apps (Swift, SwiftUI, UIKit, Objective-C), with short notes for watchOS and CarPlay. It covers simulator and device testing, permissions, lifecycle, appearance, Dynamic Type, rotation, iPad multitasking, deep links, push and in-app purchase in sandbox. Cross-platform frameworks use `cross-platform-mobile.md` as well. Store review is in `../gates/apple-app-store.md`. It usually goes with `../features/notifications.md`, `../features/payments-subscriptions.md`, `../features/accessibility.md`, `../features/privacy-consent.md` and `../features/camera-mic-sensors.md`.

## Signals

- An `.xcodeproj`, `.xcworkspace` or `Package.swift` with an iOS target; `Info.plist`; `*.swift` or `*.m` files; `Podfile`, `Cartfile`.
- A `fastlane/` folder, `ExportOptions.plist`, `.entitlements` files, an Xcode Cloud config.
- README words: "iPhone", "iPad", "TestFlight", "App Store", "SwiftUI".

## Kickoff questions

1. Which iOS versions and devices must it support (iPhone only, or iPad too)? (best guess: the project's deployment target, iPhone and iPad if the target is universal)
2. Is there a test backend and a test account, and does it use sign-in with Apple, push or in-app purchase? (best guess: yes to the first two; read the entitlements)
3. Do we have a Mac with Xcode, and any real device? (best guess: simulator only)

## Drivers

1. **`xcodebuild test` with XCTest and XCUITest.** Best deterministic driver. Needs a Mac with Xcode. Run on a named simulator destination. Read results from the `.xcresult` bundle (`xcrun xcresulttool`), not from screenshots.
2. **`xcrun simctl`.** Controls the iOS Simulator from the shell: boot and erase devices, install and launch the app, open URLs (`simctl openurl`), grant or revoke privacy permissions (`simctl privacy`), switch appearance (`simctl ui <device> appearance dark`), set the content size category, send a simulated push (`simctl push` with a JSON payload), set location, and take screenshots (`simctl io screenshot`) [1]. The agent reads the device log with `simctl spawn <device> log stream`.
3. **Maestro or Appium (XCUITest driver).** For flows written outside the app project. Maestro flows are short YAML files and cheap to run; Appium is heavier. Both work on the simulator; on a real device both need signing set up.
4. **Computer use on the Simulator window.** Last resort, when the app has no automation hooks. Screenshots only for visual checks; Simulator window sized small.
5. **Static checks:** `plutil -lint Info.plist`, `codesign -dvv`, `xcrun swift-format lint`, SwiftLint, `xcodebuild analyze`, the Xcode Thread Sanitizer and Address Sanitizer in a test run.
6. **Instruments** (`xcrun xctrace`) for leaks, hangs and energy on a device or simulator.

**Can't be driven here:** anything on a Windows or Linux machine, since Xcode and the Simulator need macOS. On a Mac, the Simulator can't test real push delivery through APNs, camera, Face ID or Touch ID hardware, Bluetooth, NFC, cellular, accurate battery and thermal behaviour, real performance, true background-fetch scheduling, CarPlay hardware or watch pairing quirks. Those become device checks. Store submission is human-only.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | latest iOS, one current iPhone simulator, light mode, English, fresh install |
| check | smoke, plus iPhone SE-class small screen, plus changed features in dark mode and with large text |
| full | pairwise over OS (minimum supported, previous, latest, beta) × device (small iPhone, Pro Max, iPad) × orientation × appearance × Dynamic Type × locale and RTL × permission state × network |
| release | full, plus real iPhone and iPad, TestFlight build, clean install and upgrade from the last release |

Dimensions: OS version; iPhone with notch and Dynamic Island, small iPhone with home button; iPad (and Split View, Slide Over, Stage Manager); orientation; light, dark and increased contrast; text size from smallest to the largest accessibility size; language including right-to-left; permission states (not asked, allowed, denied, limited); network (Wi-Fi, cellular, offline, IPv6-only).

## Check catalogue

### Smoke
- [high · auto] Build for the simulator and run the unit tests → build succeeds with no new warnings; tests pass or failures are recorded as baseline {smoke}
- [high · agent] Install on a freshly erased simulator, launch, pass onboarding → main screen shows, no crash, no console errors {smoke}
- [high · agent] Do the main task end to end, kill the app and relaunch → the result is still there {smoke}

### Install, launch and upgrade
- [high · agent] Cold launch the app 5 times → opens to a usable screen each time within a few seconds; no white or black screen that sticks
- [high · device] Install the previous release, create data, install the new build over it → data and settings migrate; no crash on first launch; no repeated onboarding
- [medium · agent] Delete and reinstall → fresh state, no leftover keychain login that breaks the app (keychain items survive uninstall on iOS)
- [medium · agent] Launch from the home screen, from a deep link, from a push, and from the app switcher → each lands on the right screen
- [medium · auto] Check launch screen configuration and app icon sizes → no default blank launch screen; an icon is present in the asset catalog (no missing or alpha-channel store icon)

### Permissions
- [high · auto] List every `NS…UsageDescription` key in `Info.plist` versus the APIs the code calls → each used permission has a clear, honest purpose string; none is missing (missing string crashes the app) [2]
- [high · agent] For each permission (camera, microphone, photos, location, contacts, notifications, Bluetooth, tracking): allow, deny, then change in Settings and return → the app handles each state and explains how to turn it on; no crash, no dead end
- [medium · agent] Request permission at the moment of need, not at launch → the prompt appears after the user taps the feature, with context first
- [medium · agent] Limited photo access and approximate location → the app works with the reduced access
- [medium · agent] `simctl privacy reset all`, then relaunch → the app asks again and doesn't assume the old answer
- [medium · agent] Tracking prompt (App Tracking Transparency) appears only if the app tracks, and nothing tracks before consent → no tracker calls before the user answers {security}

### Lifecycle, background and interruptions
- [high · agent] Press Home mid-task, wait, return → the same screen and the same unsaved input (state restoration)
- [high · agent] Background the app, kill it from the switcher (or simulate memory pressure), relaunch → it restores sensible state or starts cleanly; no lost saved data
- [medium · agent] Lock the screen during a network call or upload, then unlock → the call completes, retries or fails with a message
- [medium · device] Incoming call, alarm, Siri, and notification banner during use → app pauses and resumes; audio and video resume correctly
- [medium · device] Background tasks (refresh, uploads, location, audio): leave the app 15 minutes → the stated background behaviour works; nothing drains the battery
- [medium · agent] Switch Wi-Fi to offline to airplane mode and back mid-task → clear offline state, then recovery without relaunch
- [medium · agent] Change the system date, time zone and language while the app runs (and relaunch) → dates and text update correctly
- [low · agent] Low Power Mode on → the app still works; animations or sync may reduce as designed

### Appearance, Dynamic Type and accessibility
- [high · agent] Switch Light and Dark (simctl or Settings) while the app is open → all screens recolour; no unreadable text, white boxes or hard-coded colours; images and icons suit both
- [high · agent] Set content size to the smallest and then to the largest accessibility size (AX5) → text scales, nothing is truncated into uselessness; layouts reflow or scroll; buttons stay reachable {a11y} [3]
- [medium · agent] Bold Text, Increase Contrast, Reduce Motion, Reduce Transparency, Button Shapes on → each is respected; no required animation; text readable {a11y}
- [high · agent] Check every control has an accessibility label, role and state (inspect with the accessibility tree or `performAccessibilityAudit()` in XCUITest) → audit has no unexplained issues {a11y}
- [medium · agent] Minimum touch target size about 44 by 44 points for every tappable control → none smaller without padding {a11y} [4]
- [medium · device] VoiceOver on a real device: sign in and do the main task → every step is announced and possible; reading order is logical {a11y}
- [medium · agent] Voice Control and Switch Control names (visible labels match accessibility labels) → "Tap <label>" works for each button {a11y}
- [low · agent] Left-to-right and right-to-left languages (pseudo-language "right-to-left" in scheme options) → layout mirrors; icons that imply direction flip

### Layout, rotation and iPad
- [high · agent] Run on the smallest and the largest supported iPhone simulators → no clipped content; safe areas respected under the notch, Dynamic Island and home indicator [4]
- [medium · agent] Rotate on every screen (even if portrait-only is declared, check the declaration) → layout adapts or stays locked as designed; no state loss on rotate
- [medium · agent] Show the on-screen keyboard over the form → focused field and submit button stay visible; the keyboard dismisses on tap outside or scroll
- [high · agent] On iPad: run full screen, Split View (1/3, 1/2, 2/3), Slide Over and Stage Manager window resizing → layout adapts at each size class; no crash on resize; a universal app isn't just a stretched phone layout
- [medium · agent] iPad pointer, trackpad and hardware keyboard (shortcuts, Tab focus) → hover states, scrolling and key commands work
- [low · agent] Drag and drop, multiple windows (scenes) on iPad where claimed → each window keeps its own state; data not duplicated

### Deep links, universal links and sharing
- [high · agent] `xcrun simctl openurl booted <url>` for every custom-scheme and universal link in the docs → the right screen opens, also when the app is killed and when it's already open
- [high · auto] Fetch `https://<domain>/.well-known/apple-app-site-association` → HTTPS, no redirect, valid JSON, lists the app id and paths; matches the Associated Domains entitlement [5]
- [medium · agent] Open a deep link for a record the user isn't signed in to see → sign-in first, then land on the record; or a clear denial {security}
- [medium · agent] Malformed, very long and hostile deep-link parameters → the app ignores or rejects them; no crash, no action taken without confirmation {security}
- [medium · agent] Share sheet, Open in…, and Handoff/Quick Look entries where offered → correct file type and content

### Push notifications (sandbox only)
- [high · agent] Send a test push to the simulator with `simctl push` for each payload type (alert, silent, with deep link, with image) → banner shows; tapping opens the right screen; silent pushes don't show a banner [6]
- [medium · agent] Notification permission denied, then enabled in Settings → the app shows an in-app hint and starts delivering after enabling
- [medium · device] Real push through the APNs sandbox on a development build → arrives within a reasonable time; badge count updates and clears correctly
- [medium · agent] Unregister token on sign-out → no push for the previous user arrives on this device {security}
- [low · device] Focus modes and notification summary, notification actions (reply, snooze) → behave as designed

### In-app purchase and subscriptions (sandbox only)
- [high · agent] Use a StoreKit configuration file in Xcode (or a sandbox Apple account on device); buy, cancel mid-sheet, and fail a purchase → the app grants access only after success and recovers cleanly from cancel and failure [7]
- [high · agent] Tap "Restore Purchases" on a second install → entitlements return; the button is visible where purchases exist
- [medium · agent] Speed up renewals in sandbox, then let it renew, expire and be refunded → access follows the subscription state in both directions
- [medium · agent] Interrupted purchase (kill the app mid-transaction) and ask-to-buy → the transaction is finished on next launch; no double charge or lost entitlement
- [high · human] Real money purchase on a real account → never done by an agent; the user does a sandbox run only

### Data, security and privacy
- [high · auto] `codesign -dvv` and `plutil` on the built app → expected entitlements only; no debug entitlements or `get-task-allow` in release builds {security}
- [high · agent] Search the app bundle and logs for API keys, tokens and passwords → none in plaintext {security}
- [medium · agent] Check Keychain use for tokens and the file protection class of stored data → secrets in Keychain, not UserDefaults or plain files {security}
- [medium · agent] Check ATS (App Transport Security) settings → no blanket `NSAllowsArbitraryLoads` without need; all calls use HTTPS {security}
- [medium · agent] Screenshots in the app switcher for sensitive screens → hidden or blurred if the app promises it
- [medium · agent] Account deletion inside the app (if accounts exist) → the user can start deletion in the app and sees confirmation (store requirement; see the gate pack)
- [medium · agent] Privacy manifest and required-reason API use match what the code does → matches; third-party SDK manifests present (see the gate pack)

### Performance and stability
- [high · auto] Run the app with Address Sanitizer and Thread Sanitizer during UI tests → no reports
- [medium · agent] Scroll the longest list quickly, open and close the heaviest screen 20 times → no hitching, no memory growth; Instruments shows no leaks
- [medium · device] Cold launch time, energy and thermal state on a real older iPhone → acceptable; no heat or fast battery drain in 10 minutes of use
- [medium · agent] Weak network (Network Link Conditioner or Xcode device conditions) and IPv6-only network → loads with loading states; no crash on timeouts [8]

### watchOS and CarPlay notes
- [medium · agent] Watch app: run on a paired watch simulator, test complications, notifications and Handoff with the phone app → data syncs; the watch works while the phone is unreachable if it claims to
- [medium · device] CarPlay: run in the CarPlay simulator and then in a real car or head unit → only the allowed templates; no distracting UI; voice and audio controls work; apps need the right entitlement from Apple

## Gates

- `../gates/apple-app-store.md` for App Store Review, privacy labels, privacy manifest and TestFlight.
- Release blockers specific to iOS: crash on launch on the minimum supported OS, missing purpose strings, no restore-purchases, broken sign in with Apple when other logins exist, placeholder content, demo account not working.

## Human-only checks

- [human] Install the TestFlight build on your own iPhone and use the main task for 10 minutes while walking, switching apps, and taking a call → no crash; it feels responsive; nothing is hard to tap
- [human] Turn on VoiceOver and complete sign-in plus the main task → everything is announced and doable
- [human] Set the text size to the largest accessibility size and look at the five main screens → still usable
- [human] Make a sandbox purchase and a restore with a sandbox Apple account → access granted and restored; no real charge
- [human] Submit through App Store Connect → follow the gate pack; an agent never submits

## Known pitfalls

- **Simulator isn't a phone.** It has no real camera, push delivery through APNs, biometrics hardware, or accurate performance. Don't file "slow" or "no camera" from the simulator.
- **Simulator permission prompts reappear** after `erase`, and `simctl privacy` can pre-grant them. State which one you used.
- **Keychain survives uninstall.** A "stays signed in after reinstall" report is expected iOS behaviour unless the app claims to clear it.
- **First launch after install is slower** (cache and launch services); measure the second and later launches.
- **Console noise.** System log lines from `CoreData`, `UIKit` constraint warnings in debug builds, and "Snapshotting a view that has not been rendered" are mostly Apple-side; file only if there is a visible fault.
- **Auto Layout constraint warnings** are real but low risk unless something is visibly broken.
- **Sandbox purchase quirks.** Sandbox is slow and sometimes fails sign-in; retry once before filing. Sandbox renewals are accelerated, so don't treat the short time as a bug.
- **TestFlight builds expire** after a fixed period; an expired build isn't a bug.
- **Never use a real Apple ID password, real card or production backend.** Test accounts and sandbox only.

## Sources

1. [Apple: Running your app in Simulator or on a device](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device) — simulator use; `simctl` options are listed by `xcrun simctl help` and some details come from third-party guides (checked 2026-11-16)
2. [Apple: Protecting the user's privacy (purpose strings)](https://developer.apple.com/documentation/uikit/protecting-the-user-s-privacy) — usage description keys (checked 2026-11-16)
3. [Apple HIG: Typography (Dynamic Type)](https://developer.apple.com/design/human-interface-guidelines/typography) — text scaling (checked 2026-11-16)
4. [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — safe areas, size classes, touch target guidance (checked 2026-11-16)
5. [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) — universal links and the association file (checked 2026-11-16)
6. [Apple: Sending push notifications using command-line tools](https://developer.apple.com/documentation/usernotifications/sending-push-notifications-using-command-line-tools) — APNs sandbox and simulator push (checked 2026-11-16)
7. [Apple: Testing in-app purchases with Sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox) — sandbox accounts, renewal rate, interrupted purchases (checked 2026-11-16)
8. [Apple: App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — IPv6-only networks, completeness, restore purchases, account deletion (checked 2026-11-16)
