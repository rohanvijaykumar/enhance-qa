---
module: macos-desktop
kind: platform
title: macOS desktop apps
checked: 2026-11-16
---
# macOS desktop apps

Covers native Mac apps (AppKit, SwiftUI, Catalyst, Objective-C) distributed with Developer ID outside the Mac App Store or through it. It covers notarisation and Gatekeeper, App Sandbox entitlements, privacy (TCC) prompts, menu bar conventions, Apple silicon vs Intel and driving apps through the accessibility API. Electron and Tauri apps add `electron-tauri.md`. Notarisation steps are in `../gates/macos-notarization.md`. It goes with `../features/installers-updaters.md`, `../features/settings-persistence.md`, `../features/accessibility.md` and `../features/security.md`.

## Signals

- An `.xcodeproj` or `Package.swift` with a macOS target; `Info.plist` with `LSMinimumSystemVersion`; `.entitlements` files; `NSApplication` or SwiftUI `App` with `WindowGroup` and `MenuBarExtra`.
- A `.dmg` or `.pkg` build script, `create-dmg`, `notarytool` in CI, Sparkle (`SUFeedURL`).
- README words: "macOS", "Mac App Store", "notarized", "menu bar app".

## Kickoff questions

1. How is it distributed (Developer ID DMG or zip, `.pkg`, Mac App Store, Homebrew cask) and does it use the App Sandbox? (best guess: read the entitlements and CI scripts)
2. Which macOS versions and Mac types (Apple silicon, Intel) must it support? (best guess: the minimum in `Info.plist`; universal binary)
3. Is a Mac available for testing, and is there an Apple Developer account for notarisation? (best guess: a Mac is available; notarisation credentials are the user's and an agent doesn't see them)

## Drivers

1. **`xcodebuild test`** with XCTest and XCUITest. Deterministic unit and UI tests; read results from the `.xcresult` bundle (`xcresulttool`), not screenshots. Needs a Mac.
2. **Shell inspection tools.** `codesign -dvvv --entitlements - App.app`, `codesign --verify --deep --strict --verbose=2`, `spctl --assess --type execute -vv`, `xcrun stapler validate`, `xcrun notarytool log`, `lipo -archs`, `file`, `otool -L`, `plutil -lint`, `pkgutil --check-signature`, `hdiutil verify`. Deterministic, cheap, and the best first step for any release check [1][2].
3. **Accessibility API scripting (AX).** Drive and read the app through the macOS accessibility API using AppleScript and System Events (`osascript`), `cliclick`, Swift scripts with `AXUIElement`, or tools such as Peekaboo. Scope to one app and one window; print only names, roles and values. The terminal or agent process needs the Accessibility (and for screenshots, Screen Recording) permission from the user [3].
4. **`defaults`, `tccutil`, `log stream`, `fs_usage`.** Read and reset app preferences, reset TCC permissions for a test bundle id (`tccutil reset All <bundle-id>`), watch the unified log for the app, and watch file access. Use `log stream --predicate 'subsystem == "..."'`.
5. **Clean user or VM.** A second macOS user account or a macOS VM (Tart, UTM, VirtualBuddy with Apple's Virtualization framework) to test a first run without the developer's state. VMs can't run all hardware-dependent features.
6. **Computer use / screenshots.** Last resort for visual checks (Retina rendering, dark mode, window chrome); window at 1280×800 or smaller.

**Can't be driven here:** on Windows or Linux there is no way to run macOS apps; this module becomes a gap unless a Mac is available. On a Mac, an agent can't approve TCC permission prompts or Gatekeeper first-launch dialogs (these need the user's click and sometimes password); can't judge Retina crispness or "feel"; can't use real notarisation credentials; and can't test on Intel hardware if only Apple silicon is present (Rosetta tests the reverse direction only: Intel code on Apple silicon). Those become human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | latest macOS, Apple silicon, light mode, fresh user, main task |
| check | smoke, plus dark mode, plus changed features and one older supported macOS |
| full | pairwise over macOS version (minimum, previous, latest) × architecture (arm64, x86_64 via Rosetta or Intel Mac) × appearance × display (Retina, external non-Retina) × permission state × sandboxed or not × language |
| release | full, plus the actual downloaded notarised artefact opened on a clean Mac with quarantine set, upgrade over the previous release, human checks |

Dimensions: macOS version; arm64 and Intel; light, dark, and accent colour; Retina and non-Retina and multiple displays; Spaces and full-screen; TCC permission state (not asked, allowed, denied); sandbox on or off; language including RTL; trackpad, mouse and keyboard; menu bar and Dock settings.

## Check catalogue

### Smoke
- [high · auto] `xcodebuild` Release build and unit tests → builds without new warnings; tests pass {smoke}
- [high · auto] `codesign --verify --deep --strict` and `spctl --assess` on the built app → valid signature and "accepted" with the expected source (Notarized Developer ID) {smoke}
- [high · agent] Launch a freshly copied app as a new user, do the main task, quit and relaunch → the result persists {smoke}

### Signing, notarisation and Gatekeeper
- [high · auto] `codesign -dvvv` on the app and every nested binary, helper, framework and XPC service → all signed with the same team identity, hardened runtime flag set, secure timestamp present [1]
- [high · auto] Check entitlements with `codesign -d --entitlements -` → no `com.apple.security.get-task-allow` in release; only entitlements the app needs; hardened-runtime exceptions (JIT, unsigned memory, library validation off) each justified {security}
- [high · gate] Submit with `xcrun notarytool submit --wait` using the user's credentials → status Accepted; the log has no issues; the user runs this, an agent doesn't hold credentials [1]
- [high · auto] `xcrun stapler staple` then `stapler validate` on the app, DMG or pkg → ticket stapled so it opens offline
- [high · agent] Download the artefact (or add the quarantine flag with `xattr -w com.apple.quarantine`), then open it on a clean Mac → opens with the standard "downloaded from the internet" prompt only, no "damaged" or "unidentified developer" block; no Gatekeeper translocation breaking the app (an app that reads files next to itself)
- [medium · auto] `spctl --assess --type install` for pkg and `pkgutil --check-signature` → signed with an installer identity
- [medium · auto] DMG: mount with `hdiutil attach`, check the layout (app plus Applications alias), the licence if present, and that the DMG itself is signed and notarised → drag-install works from the mounted image
- [medium · auto] `lipo -archs` on the main binary and frameworks → expected architectures (arm64 and x86_64 for a universal app); no x86-only dependency in an arm64 app [4]

### App Sandbox and entitlements (if sandboxed or Mac App Store)
- [high · auto] Read the entitlements file → `com.apple.security.app-sandbox` present for Mac App Store builds; each extra entitlement (network client or server, user-selected files, downloads folder, camera, mic, location, Bluetooth, USB) matches a real feature [5] {security}
- [high · agent] Use every file feature: open, save, drag and drop, recent files, export, folders chosen once and reused (security-scoped bookmarks) → works after relaunch; no "operation not permitted" in the log
- [medium · agent] Run `log stream` and look for `deny` or `sandbox` lines during the main flow → none for intended features; each denial points to a missing entitlement or a bug
- [medium · agent] Container paths: data in `~/Library/Containers/<bundle-id>` if sandboxed → data lives there; uninstall guidance matches
- [medium · agent] Helpers, login items, XPC services, and launch agents → registered with the modern service APIs (SMAppService) and inherit or declare the right sandbox; they appear in Login Items settings and can be disabled there
- [low · agent] Network entitlements and App Transport Security → HTTPS used; local network access prompts appear if needed

### Privacy prompts (TCC)
- [high · auto] List the `NS…UsageDescription` keys against the APIs used → each privacy-sensitive API (camera, mic, contacts, calendars, photos, Desktop and Documents folders, Downloads, removable volumes, location, screen recording, accessibility, Full Disk Access, input monitoring) has a clear purpose string [6]
- [high · agent] `tccutil reset All <bundle-id>`, then trigger each protected feature → one prompt appears at the moment of need; allow and deny both leave the app working, with a pointer to System Settings > Privacy & Security
- [medium · human] Permissions that can't be prompted (Accessibility, Screen Recording, Full Disk Access, Input Monitoring) → the app explains and opens the right settings pane; works after the user grants, and after relaunch where macOS requires it
- [medium · agent] Revoke a permission while the app runs → app notices, stops cleanly and doesn't crash or loop
- [medium · agent] Rebuilding with a new signature changes identity → note that TCC may re-prompt for dev builds; check that the shipped build keeps its grants after an update (same team id and bundle id)

### Menu bar, windows and conventions
- [high · agent] Open every menu from the menu bar → standard menus exist (app menu with About, Settings, Hide, Quit; File, Edit, View, Window, Help); items enable and disable by context; no empty or placeholder items [7]
- [high · agent] Standard shortcuts: Cmd+Q, Cmd+W, Cmd+M, Cmd+,, Cmd+C/V/X/Z/Shift+Z, Cmd+A, Cmd+F, Cmd+N, Cmd+H → each works and matches the macOS meaning; no Ctrl-based Windows conventions
- [medium · agent] Close the last window, then reopen from the Dock and from the app switcher → app stays running or quits as designed; reopen creates a window
- [medium · agent] Settings window (Cmd+,) → exists and changes apply live; matches the macOS style
- [medium · agent] Full screen, Split View, Stage Manager, Spaces, Mission Control, minimise to Dock → window behaves; state kept; no layout break at small and large sizes
- [medium · agent] Menu bar extra (status item) apps → icon visible in light and dark and on notched displays; menu works; app can quit; hidden when the bar is full is acceptable
- [medium · agent] Dock icon, badge, Dock menu, app name and icon in the About box and Activity Monitor → right name, icon and version
- [low · agent] Services menu, share extensions, Quick Look, Spotlight (document types), Handoff where claimed → each works
- [medium · agent] File associations and URL schemes: double-click a document, `open -a`, `open myapp://…` → right app opens with the file; hostile parameters ignored {security}
- [medium · agent] Undo/redo, autosave and versions, recent documents, drag to Dock icon → work where the app is document-based

### Appearance and accessibility
- [high · agent] Light, dark and auto appearance, and accent colour and highlight settings, switching while the app is open → colours follow; no unreadable text or white flash {a11y}
- [high · agent] Accessibility inspector or AX tree for each main window → every control has a role, label and value; custom views expose accessibility; focus order logical {a11y}
- [medium · agent] Increase contrast, Reduce motion, Reduce transparency, Differentiate without colour and larger text (where supported) → each is respected {a11y}
- [medium · agent] Full keyboard access (System Settings > Keyboard) → Tab reaches every control; Esc and Return behave in dialogs {a11y}
- [medium · device] VoiceOver on the main task → every element announced; navigation possible without sight {a11y}
- [medium · agent] Retina and non-Retina displays and moving between them → images and text crisp on both; no blurry assets (provide @2x)

### Apple silicon vs Intel
- [high · auto] Check the app, plug-ins, helpers and bundled tools with `lipo` and `file` → every binary contains the claimed architectures; an arm64 app doesn't load an x86-only plug-in [4]
- [high · agent] Run the main flow natively on Apple silicon and, if available, on an Intel Mac or under Rosetta (`arch -x86_64`) → same behaviour; Rosetta translation works for Intel builds [8]
- [medium · agent] Performance of heavy tasks on both → no large unexpected slowdown on the claimed architecture; Metal and GPU paths work on both
- [medium · auto] Build scripts and CI produce a universal or per-architecture release as stated → the downloaded artefact has what the website promises

### Lifecycle, updates and stability
- [high · agent] Sleep and wake, lock and unlock, fast user switching, display sleep, log out and back in → the app resumes; network and devices reconnect
- [high · agent] Auto-update (Sparkle or the App Store): update from the previous release to the new one with a test feed → updated app is signed and notarised, opens without prompts; settings and data intact; update signature (EdDSA) verified {security}
- [medium · agent] Quit during save, force-quit, and power loss simulation in a VM → no corrupt file; recovery or autosave
- [medium · agent] Check Console and `~/Library/Logs/DiagnosticReports` after a run → no crash reports, no repeated errors from the app
- [medium · agent] Long run (an hour) → memory flat in Activity Monitor; no runaway CPU while idle; App Nap and energy impact fine
- [medium · agent] Uninstall: delete the app and follow the documented clean-up (`~/Library` support files, login items, launch agents, helper tools) → nothing keeps running; documented leftovers are only user data
- [low · agent] First launch from `/Applications`, from `~/Downloads` and from a read-only DMG → works in each; no assumption it lives in `/Applications`

### Security
- [high · auto] Search the bundle and logs for secrets, tokens, test keys and debug flags → none {security}
- [medium · auto] Check hardened runtime exceptions, `NSAllowsArbitraryLoads`, custom URL schemes and XPC services for access control → least privilege; XPC validates its client {security}
- [medium · agent] Keychain use for tokens; no tokens in `UserDefaults` or plain files → secrets in Keychain {security}
- [medium · agent] Privacy manifest and required-reason APIs if Mac App Store → declared matches the code (see the Apple gate pack)

## Gates

- `../gates/macos-notarization.md` for Developer ID notarisation, hardened runtime, stapling and Gatekeeper.
- `../gates/apple-app-store.md` if shipped through the Mac App Store (sandbox is required there).
- Release blockers specific to macOS: not notarised or not stapled, "damaged" or "unidentified developer" on a clean Mac, `get-task-allow` in release, arm64 build missing a claimed architecture, no sandbox on a Mac App Store build, TCC strings missing.

## Human-only checks

- [human] On a Mac that has never seen the app, download the real release link and open it → standard first-run dialog only; the app opens; note anything alarming
- [human] Grant and deny each privacy permission when prompted (or in System Settings) → the app behaves in both cases
- [human] Open the app with VoiceOver on and do the main task → doable
- [human] Look at the app on a Retina display and an external monitor in light and dark → crisp, sensible
- [human] Run notarisation and the Mac App Store upload with your credentials → an agent never holds or enters them

## Known pitfalls

- **Gatekeeper behaves differently for a locally built app.** Only a quarantined, downloaded copy shows the real first-run flow; build outputs on the dev machine skip it.
- **Notarisation needs the user's credentials and network.** If you can't run it, report the checks you couldn't do; don't claim notarised from `codesign` alone.
- **TCC grants are tied to signature and bundle id.** A debug build re-prompts; the terminal or Xcode may be the one holding the permission during dev runs. Reset with `tccutil` before judging prompts.
- **App Translocation** moves a quarantined app to a random read-only path; an app that reads files beside itself breaks only there.
- **Rosetta is Intel-on-Apple-silicon only.** It doesn't prove the app runs on an Intel Mac for hardware features.
- **Console and log noise** from the system (`cfprefsd`, `tccd`, `launchservices`) is mostly not the app; filter by process.
- **Dark mode flashes in Xcode previews** aren't release bugs; test the built app.
- **System Settings layout changes** between macOS versions; instructions that point to a pane may need updating, which is not a bug in the app.
- **Don't enter an Apple ID password, app-specific password or certificate password.** Those are for the user.

## Sources

1. [Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) — Developer ID, hardened runtime, secure timestamp, no `get-task-allow`, stapling (checked 2026-11-16)
2. [Apple: Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) — `notarytool`, logs, `stapler` (checked 2026-11-16)
3. [Apple: Accessibility (AXUIElement)](https://developer.apple.com/documentation/applicationservices/axuielement_h) — the accessibility API used for UI scripting; details of Peekaboo and System Events come from tool docs (checked 2026-11-16)
4. [Apple: Building a universal macOS binary](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary) — arm64 and x86_64 slices (checked 2026-11-16)
5. [Apple: App Sandbox](https://developer.apple.com/documentation/security/app-sandbox) — sandbox and entitlements (checked 2026-11-16)
6. [Apple: Protected resources (usage description keys)](https://developer.apple.com/documentation/bundleresources/protected-resources) — purpose strings for privacy-sensitive APIs (checked 2026-11-16)
7. [Apple HIG: The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar) — standard menus and shortcuts (checked 2026-11-16)
8. [Apple: About the Rosetta Translation Environment](https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment) — running Intel code on Apple silicon (checked 2026-11-16)
