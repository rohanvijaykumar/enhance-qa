---
module: microsoft-store
kind: gate
title: Microsoft Store and the Windows App Certification Kit
checked: 2026-11-16
---
# Microsoft Store and the Windows App Certification Kit

Pre-checks for submitting a Windows app (MSIX, or an unpackaged app wrapped as MSIX) or a game to the Microsoft Store. Mirrors the Store Policies and the Windows App Certification Kit (WACK). Agents run WACK and prepare listings. The Partner Center submission is a human step. Use with `../platforms/windows-desktop.md`, `windows-code-signing.md` and, for games, `age-ratings.md`.

## Signals

- `Package.appxmanifest`, `AppxManifest.xml`, a `.msix` or `.msixbundle`, a Windows Application Packaging project, or `winapp`/MSIX tooling in CI.
- The plan names "Microsoft Store" or "Partner Center", or a Windows `release` pass with Store as a channel.

## Kickoff questions

1. Is it packaged as MSIX already, or will it be converted? (best guess: read the repo)
2. Does it use in-app purchase, subscriptions or ads? (best guess: read the code)
3. Does it need restricted capabilities such as `runFullTrust`? (best guess: read the manifest)

## Drivers

1. **WACK command line.** `appcert.exe test -appxpackagepath <file>.msix -reportoutputpath report.xml`. Run on a clean Windows machine or VM. Read the XML or HTML report; it gives pass or fail per test. Can't test the content review.
2. **Manifest and package inspection.** `makeappx unpack`, `signtool verify /pa`, reading `AppxManifest.xml`. Cheap and exact.
3. **Install and run on a clean VM.** `Add-AppxPackage`, UI Automation or screenshots at 1280×800 or less, then `Remove-AppxPackage` to check uninstall.
4. **Partner Center.** Needs the user's Microsoft login. Agents never type it.

**Can't be driven here:** Partner Center submission, malware scan, content review, Store certification, real purchases, physical Surface or Xbox hardware.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used; this pack runs on `release` passes |
| check | WACK plus manifest checks |
| full | WACK, install, uninstall and upgrade on clean VMs |
| release | everything, plus listing, age rating and human checks |

Dimensions: x64 and ARM64, Windows 10 and latest 11, 100% and 200% scale, standard user versus admin, low-power machine at 1366×768.

## Check catalogue

### WACK and package
- [high · auto] Build a Release (not Debug) package and run WACK on a clean machine → report shows Pass for every test; any Fail is fixed {smoke}
- [high · auto] WACK "App manifest" tests → manifest is valid; display name, publisher, capabilities, logos and version are set correctly
- [high · auto] WACK launch, crash and hang tests, including the "launch on a future OS" test → app starts, stays responsive and doesn't crash (see Sources 2)
- [high · auto] WACK BinScope security tests → ASLR and DEP are on for the binaries; no leaked signing key file (.pfx) or private key in the package (see Sources 2)
- [medium · auto] WACK supported-API and debug-build checks → no banned APIs and no debug binaries
- [medium · auto] WACK default-image and resource tests → all required logo assets exist at the right sizes
- [medium · auto] Package architecture matches the manifest (x64, ARM64, neutral) → no mismatched binary
- [medium · auto] Paths inside the package stay within the Windows path limit → WACK path-length check passes
- [high · auto] Package identity name and publisher match the reserved Partner Center app name → upload is accepted, not rejected for identity mismatch
- [medium · auto] The MSIX is not signed with a self-signed or test certificate meant for sideloading when submitting → the Store re-signs; a signed package is not required for Store upload, but identity must match

### Policy checks (Store Policies)
- [high · agent] Fresh install on a clean VM then launch → app is fully functional, no placeholders, and no hidden features (policy 10.1)
- [high · agent] Use the test account on the live servers → reviewer can sign in; demo credentials and notes are ready (policy 10.3, "testable")
- [high · agent] Leave the app idle, minimise, and close it → stays responsive and shuts down cleanly (policy 10.4)
- [medium · agent] On an unsupported device or OS, launch the app → it detects this and says why (policy 10.4.1)
- [high · agent] Uninstall from Settings → app and its files are removed; no orphan services, startup entries or scheduled tasks (policy 10.2.7)
- [medium · agent] Check the app doesn't modify the system, install other software silently or use Store-banned update methods → no self-updater that bypasses the Store for a Store build
- [medium · agent] If the app sells digital goods, check it uses the Store commerce flow or the policy-allowed alternative, and a test purchase works with a test account → entitlement granted once; no real card used
- [medium · agent] Check the privacy policy is linked in the listing and in the app when personal data is used → link works and matches real behaviour
- [medium · agent] Capabilities in the manifest are each justified; `runFullTrust` and other restricted capabilities have a written reason → no unused capability

### Listing and submission
- [high · human] Listing text, screenshots and trailers show the real product; no misleading claims or other-store badges → matches the app
- [medium · human] Age rating questionnaire (IARC) answers match the content → rating is right; see `age-ratings.md`
- [medium · human] Certification notes explain how to test, give the test account and mention any hardware or region need → a tester can complete the flows
- [medium · human] Pricing, markets and availability set as planned → matches the release plan
- [high · gate] Submit in Partner Center and wait for certification (malware scan, WACK-based technical check, then content review; usually a few business days) → "In the Store" status (see Sources 3)
- [medium · gate] Install the published app from the Store on a clean machine → installs, launches and updates

## Gates

WACK all pass, policy lines pass and the listing is accurate. Store policies are versioned, so state the version used in the report.

## Human-only checks

- [human] Reserve the app name, complete the Partner Center account and tax details, and press Submit.
- [human] Install from the Store on a personal PC after publication. Judge: no SmartScreen warning, and the app is what the listing says.
- [human] Read the age rating and privacy answers against the app. Judge: they are true.

## Known pitfalls

- WACK results can differ between machines and between WACK versions. Run it on a clean machine and note the version.
- Some WACK items are warnings for apps that are not packaged as UWP. Read the test description before filing.
- A Debug build fails WACK, so don't file that as a product bug; rebuild in Release.
- Store policies change in dated versions. Note the version you read.
- Don't use real Microsoft accounts or cards for tests.
- SmartScreen warnings apply outside the Store only; Store installs are not affected (see `windows-code-signing.md`).

## Sources

1. [Microsoft Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) — policies 10.1, 10.2.7, 10.3, 10.4; version 7.20 dated 14 September 2026 per research note 2 (checked 2026-11-16)
2. [Windows App Certification Kit tests](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit-tests) — WACK test list (checked 2026-11-16 via research notes 2 and 5)
3. [App certification process](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-certification-process) — malware scan, technical compliance, content review (checked 2026-11-16 via research note 2)
4. [SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) — Store apps carry no SmartScreen warning (checked 2026-11-16)
