---
module: macos-notarization
kind: gate
title: macOS notarisation and Gatekeeper
checked: 2026-11-16
---
# macOS notarisation and Gatekeeper

Pre-checks for distributing a Mac app, command-line tool, installer or plug-in outside the Mac App Store. Covers Developer ID signing, the hardened runtime, notarisation, stapling and the Gatekeeper test on a downloaded copy. Mac App Store apps use `apple-app-store.md` instead and don't need notarisation. Use with `../platforms/macos-desktop.md` and `audio-plugin-validation.md` for plug-in bundles. Needs a Mac for every command here. A Windows machine can't run them.

## Signals

- An Xcode or Tauri/Electron project that ships a `.app`, `.dmg`, `.pkg` or `.zip` for direct download.
- Config with `codesign`, `notarytool`, `electron-builder` `mac` target, `tauri.conf.json` signing identity, or `APPLE_ID` / `APPLE_TEAM_ID` secrets.
- The plan names "notarize", "Developer ID" or "Gatekeeper".

## Kickoff questions

1. Is the artifact an app, a DMG, a PKG, or a plug-in or CLI binary? (best guess: read the build script)
2. Is there a Developer ID certificate and a notarytool keychain profile set up by the user? (best guess: ask; agents never handle the credentials)

## Drivers

1. **Command-line tools on a real Mac.** `codesign`, `spctl`, `stapler`, `xcrun notarytool`, `pkgutil`, `lipo`, `otool`, `xattr`. Output is exact and cheap to read.
2. **Clean second Mac or fresh macOS VM.** To test the file as a user gets it (downloaded, quarantined). Use a VM snapshot where licensing allows, or a spare Mac.
3. **notarytool log.** `xcrun notarytool log <id> --keychain-profile <name>` gives per-file issues.

**Can't be driven here:** a Mac is needed for all of it. The notarytool submission itself uses the user's Apple credentials, so a human runs the submit step or has set up a keychain profile; agents never type or store Apple passwords or app-specific passwords. The first-run Gatekeeper dialog must be seen by a person.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | local `codesign` and entitlement checks |
| full | check, plus notarise and staple a release candidate |
| release | full, plus the quarantine test on a clean Mac, on Intel and Apple silicon if both are supported |

Dimensions: app, DMG, PKG, plug-in; architectures (arm64, x86_64, universal); minimum and latest macOS.

## Check catalogue

### Signing
- [high · auto] `codesign --verify --deep --strict --verbose=2 MyApp.app` → exits 0 with "valid on disk" and "satisfies its Designated Requirement" {smoke}
- [high · auto] `codesign -dvv MyApp.app` → Authority line shows "Developer ID Application", the right Team ID, and a Timestamp line (secure timestamp); no "adhoc" and no `Signature=adhoc`
- [high · auto] Every nested binary, framework, helper, XPC service and plug-in in the bundle is signed with the same identity → `codesign --verify` passes; nothing is signed "inside-out" wrongly
- [high · auto] `codesign -d --entitlements - MyApp.app` → hardened runtime flag is shown (`flags=0x10000(runtime)`), and `com.apple.security.get-task-allow` is absent (see Sources 1)
- [medium · auto] List entitlements and compare with need: `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`, `network.client`, camera, microphone → only the ones the app really needs are present, each with a written reason
- [medium · auto] CLI tools and helper binaries are signed with the hardened runtime too → `codesign -dv` shows `runtime` on each
- [medium · auto] `lipo -info` on the main binary → matches the architectures claimed (arm64 and x86_64 for universal)
- [medium · auto] Check Info.plist `LSMinimumSystemVersion`, `CFBundleVersion`, bundle ID and usage-description strings → all present and match the plan

### Notarisation and stapling
- [high · gate] Submit the signed archive: `xcrun notarytool submit file.zip --keychain-profile <profile> --wait` → status "Accepted"; done by a human or with the user's profile (altool is no longer accepted; use notarytool) (see Sources 2)
- [high · auto] On a rejection, run `xcrun notarytool log <id>` → the JSON log lists each issue; every one is fixed before resubmitting
- [high · auto] Staple the ticket to the app, DMG or PKG: `xcrun stapler staple file` then `xcrun stapler validate file` → "The validate action worked!"
- [medium · auto] If the release is a DMG containing an app, check that both the app inside and the DMG were signed and notarised in the right order → both validate
- [medium · auto] If the release is a PKG, `pkgutil --check-signature file.pkg` → signed with "Developer ID Installer" and the timestamp is present
- [medium · auto] Re-zip with `ditto -c -k --keepParent` rather than plain `zip` after signing → signature survives; a plain zip can break symlinks
- [medium · auto] Check the stapled artifact is the exact file uploaded to the website or update feed → hash of the published file equals the validated one

### Gatekeeper and quarantine
- [high · auto] `spctl --assess --type execute --verbose=4 MyApp.app` → "accepted" with "source=Notarized Developer ID"
- [high · auto] For a PKG, `spctl --assess --type install --verbose=4 file.pkg` → accepted, source Notarized Developer ID
- [high · device] Copy the final download to a clean Mac as a user would (browser download, AirDrop or `curl`), so it carries the quarantine attribute: `xattr -l MyApp.app` shows `com.apple.quarantine` → opens by double-click with at most the standard "downloaded from the internet" prompt, with no "damaged" or "unidentified developer" block
- [high · device] Open it on a clean Mac that is offline → a stapled app opens; an unstapled one may need the network, so note which
- [medium · device] First launch triggers each permission prompt (camera, microphone, Documents, Accessibility) with the usage string, and denial is handled → app doesn't crash on denial
- [medium · device] If the app auto-updates, install an update over the previous release on a clean Mac → the new version passes Gatekeeper again, and the signing team ID is unchanged
- [medium · device] Test on Apple silicon and, if claimed, Intel (or Rosetta) → both run

### Plug-ins and helpers
- [high · device] Quarantined plug-in bundles (AU, VST3, CLAP): install into the user library and scan in a host → on macOS 10.15 and later a plug-in that isn't notarised needs the user's explicit approval; the notarised one loads without it (see Sources 1)
- [medium · auto] Installer scripts or postinstall hooks are signed and don't modify system settings silently → none found

## Gates

Signed with Developer ID, hardened runtime, secure timestamp, accepted by notarytool, stapled, and `spctl` accepts the quarantined download on a clean Mac. All gate and device lines are human sign-off.

## Human-only checks

- [human] Run the notarytool submit with your own keychain profile. Agents never enter your Apple ID or app-specific password.
- [human] Download the release from the real link on a second Mac and open it. Judge: no scary dialog beyond the usual one.
- [human] Check the app name, icon and publisher shown in the dialog. Judge: they are the real ones.

## Known pitfalls

- Notarisation is an automated malware and signing scan. It is not App Review and doesn't judge features.
- `spctl --assess` on a file that has no quarantine flag can pass even if the download would fail. Test the quarantined copy.
- Files built on the machine itself don't carry quarantine. Don't call a local run a Gatekeeper pass.
- Notarisation can take minutes, rarely longer. A long wait is not a failure; check the log.
- A stapler error right after acceptance can be Apple's CDN delay. Retry a few minutes later before filing.
- Re-signing after stapling breaks the ticket. Staple last.
- Certificates expire and can be revoked. Check the expiry in `codesign -dvv` output and Keychain Access.

## Sources

1. [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) — hardened runtime, secure timestamp, get-task-allow, plug-in behaviour (checked 2026-11-16 via research notes 2 and 5)
2. [Upcoming requirements for App Store submissions](https://developer.apple.com/news/upcoming-requirements/) — altool and old Xcode no longer accepted by the notary service from 1 November 2023; use notarytool (checked 2026-11-16)
3. [Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow) — notarytool and logs (not re-fetched this pass)
4. [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime) — entitlements for the runtime (not re-fetched this pass)
