---
module: apple-app-store
kind: gate
title: Apple App Store review
checked: 2026-11-16
---
# Apple App Store review

Pre-checks for submitting an iOS, iPadOS, tvOS, visionOS, watchOS or Mac App Store app. It mirrors the App Review Guidelines items that most often cause rejection. Agents prepare and pre-check. Uploading a build, answering the App Store Connect forms and pressing "Submit for Review" are human steps. Use with `../platforms/ios.md` (or `macos-desktop.md`) and `../features/privacy-consent.md`. For notarised Mac apps outside the store, see `macos-notarization.md`.

## Signals

- An Xcode project or workspace, a `.xcodeproj`, `Info.plist`, `fastlane/` with `deliver` or `pilot`, an `ExportOptions.plist`, or an Expo/EAS config with an iOS submit profile.
- The plan names "App Store", "TestFlight" or a `release` pass for an iOS or macOS app.
- Words in the README such as "submit to the App Store".

## Kickoff questions

1. Does the app have accounts or login, and which sign-in methods? (best guess: read it from the code; ask only if unclear)
2. Does it sell anything digital (subscriptions, credits, unlocks)? (best guess: yes if StoreKit or RevenueCat is a dependency)
3. Is there a test account with seeded data the reviewer can use? (best guess: create one in staging)

## Drivers

1. **Static checks on the archive and project.** `plutil -lint Info.plist`, `xcodebuild -showBuildSettings`, grep for `NS*UsageDescription` keys, `PrivacyInfo.xcprivacy`, `ITSAppUsesNonExemptEncryption`. Cheap and exact. Cannot judge wording or intent.
2. **Simulator run.** `xcrun simctl` to install, launch, grant or reset permissions, and take screenshots at 1280×800 or less for visual checks. Read the accessibility tree rather than screenshotting every step. Cannot reproduce Apple Pay, push, Sign in with Apple, StoreKit sandbox dialogs or real-network conditions.
3. **Link and URL checker.** `curl -I` or a link checker over the privacy policy, support and marketing URLs. Read-only.
4. **Real device with a TestFlight build.** The only way to see what the reviewer sees (release configuration, production backend, IPv6 networks). Human or device.
5. **App Store Connect.** Needs the user's login. Agents never type Apple credentials. The user pastes metadata or confirms it.

**Can't be driven here:** App Store Connect itself, App Review's judgement, real IAP sandbox purchases, push delivery, Apple's actual decision. These are human or gate checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used; this pack runs on `release` passes |
| check | static checks plus the account-and-privacy block |
| full | all auto and agent lines on a Release build |
| release | everything, plus human and device lines on a TestFlight build |

Dimensions: iPhone and iPad sizes the app claims to support, minimum and latest iOS, fresh install versus update, signed in versus signed out, IPv6-only network.

## Check catalogue

### Build and completeness (Guideline 2)
- [high · auto] Archive is built with the Xcode and SDK versions Apple currently requires for uploads, and targets at least the minimum iOS version Apple currently allows → upload validation raises no SDK or deployment-target error (see Sources 2) {smoke}
- [high · agent] Launch the Release build on a clean simulator and a real device, then walk every top-level screen → no crash, hang or blank screen; crashes are the most common rejection (2.1)
- [high · agent] Search all screens, strings and assets for "lorem", "TODO", "test", placeholder images and dummy prices → none found (2.1 asks for final content)
- [high · auto] Check every URL in the app and in the store listing (privacy policy, support, terms, marketing) → each returns 200 and shows real content, not a 404 or a template
- [high · agent] Use the reviewer account on a Release build against the production backend → login works and the main flow completes; backend is live during review (2.1)
- [medium · agent] Run with network off, then on a slow network → clear error or offline state, no crash
- [medium · agent] Check the app is more than a wrapped website or a single-purpose stub → it offers real native value (4.2); list what a reviewer would see in five minutes
- [medium · device] Test on a physical iPhone (and an iPad if iPad is supported) on a Wi-Fi network that is IPv6-only → app works (2.5.5 is checked by reviewers)
- [medium · auto] Scan for private or deprecated API use and non-public frameworks → none; only public APIs (2.5.1)
- [medium · auto] Check the app does not download and run new code that changes features → nothing like that (2.5.2)

### Privacy and data (Guideline 5)
- [high · auto] Every `NS*UsageDescription` key the code needs exists, and each string says what the data is used for in plain words → none missing, none generic like "needs access" (5.1.1)
- [high · auto] A privacy manifest `PrivacyInfo.xcprivacy` is present for the app and for bundled third-party SDKs that use required-reason APIs, with approved reasons → upload shows no privacy-manifest warning (see Sources 2)
- [high · agent] Compare the App Privacy answers (nutrition labels) draft against what the code and SDKs really collect (analytics, ads, crash reporting, auth) → each collected data type is declared; no undeclared collection
- [high · agent] Privacy policy is linked in App Store Connect and inside the app, and covers collection, use, sharing, retention and how to request deletion → all present (5.1.1)
- [high · agent] If the app tracks users across other companies' apps or sites, the App Tracking Transparency prompt shows before tracking starts, and denying it stops tracking → no tracking identifiers sent after "Ask App Not to Track" (5.1.2) {security}
- [high · agent] If the app lets users create an account, find "Delete account" inside the app and run it on a test account → account and data are deleted or a clear deletion flow starts; not just "contact support" (5.1.1(v))
- [medium · agent] Deny each permission in turn (camera, location, photos, notifications, contacts) → the app still works for features that don't need it, and doesn't nag or block (5.1.1)
- [medium · agent] Check permission prompts appear in context, not all at first launch → each appears when the feature is first used

### Sign-in and accounts (Guideline 4.8)
- [high · agent] If the app offers Google, Facebook or another third-party or social login as its primary sign-in → an equivalent option is offered that limits data to name and email, can hide the email, and does not track for ads without consent (4.8). Sign in with Apple meets this
- [medium · agent] Sign in with Apple flow on a test Apple ID, including "Hide My Email" → account is created, and deletion works for it too
- [medium · agent] Signed-out experience: does the app require sign-in without needing account features? → sign-in is required only when the app has significant account-based features (5.1.1)

### In-app purchase (Guideline 3.1)
- [high · agent] Unlock of digital content or features goes through StoreKit in-app purchase, with no external payment links or license-key purchase inside the app, except where Apple's current rules for your region allow it → no violating flow (3.1.1)
- [high · agent] In the StoreKit sandbox with a sandbox tester, buy, cancel mid-way, and restore purchases → entitlement is granted once, and Restore Purchases works and is visible (3.1.1)
- [medium · agent] Subscription screen shows price, billing period, renewal terms and how to cancel before purchase → all visible, plus links to terms and privacy
- [medium · agent] Expire, fail and refund a sandbox subscription → access is removed or kept per the product rules; no crash

### User-generated content (Guideline 1.2), where it applies
- [high · agent] If users post content, check filtering, a report control, blocking of abusive users and published contact details → all four exist and work in a test account (1.2)

### Metadata, screenshots and review notes (Guideline 2.3)
- [high · human] Screenshots show the app in use, not only a splash, login page or title art, and match the current UI → reviewer sees the real product (2.3.3)
- [high · agent] Screenshot sizes and counts match what App Store Connect currently requires for each device family claimed → upload accepts them, none stretched
- [medium · human] Name, subtitle, description, keywords and age rating answers are accurate and don't mention other platforms, unreleased features or competitor names → no misleading claim (2.3)
- [high · human] Review notes explain how to reach every feature, list the demo account (a test account only, never a real person's), and explain any hardware or region needs → a reviewer can finish the flows without contacting you (2.1)
- [medium · human] Age rating questionnaire answers match the real content, including UGC, web access and in-app purchases → answers reviewed against the app, not copied from an earlier version

### Export compliance and TestFlight
- [medium · auto] `ITSAppUsesNonExemptEncryption` is set to a value the team has decided on, and the export-compliance answers match what the app does (standard HTTPS only, or custom crypto) → upload does not stop on an export-compliance prompt
- [medium · gate] Upload a build to TestFlight and install it through an internal test group → build processes, installs and launches on a real device
- [medium · gate] External TestFlight testing, if used, has test information filled in and passes Beta App Review → build available to external testers (betas belong in TestFlight, not the store: 2.2)
- [high · gate] Final submission in App Store Connect → status "Waiting for Review" and then a decision; reviewed by a human, not an agent

## Gates

All the lines above marked high, plus the human lines, must pass before submission. A rejection reason from Apple is added to the plan as a new check. See `../platforms/ios.md` for runtime checks and `../features/payments-subscriptions.md` for purchase flows.

## Human-only checks

- [human] Create the app record, fill in Privacy and Age Rating forms, and press Submit in App Store Connect. Agents never enter Apple credentials.
- [human] Install the TestFlight build on a personal device. Open it fresh, sign in with the review account, and finish the main flow. Judge: would a stranger understand it?
- [human] Read the review notes and the screenshots side by side. Judge: does what is promised match what is shown?
- [human] Read the privacy policy against the nutrition labels. Judge: do both say the same thing?
- [human] Buy once with a sandbox tester and once restore. Judge: no real money moves, and it feels trustworthy.

## Known pitfalls

- A guideline number may move between guideline updates. Quote the rule text and the link, not just the number.
- Sandbox purchases and TestFlight builds behave a little differently from production. A fail in sandbox alone is not proof.
- The simulator has no Sign in with Apple, push or real StoreKit receipts. Don't mark those passed from the simulator.
- A third-party SDK can add an unlisted data collection. That is a real issue, but report the SDK name.
- Review notes with a real person's account or a real payment card are a safety problem. Use test data only.
- Apple's upload requirements (Xcode version, minimum OS) change every spring and autumn. Re-check the news page before each release.

## Sources

1. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — rules 1.2, 2.1, 2.2, 2.3, 2.5, 3.1.1, 4.2, 4.8, 5.1.1, 5.1.2 (checked 2026-11-16)
2. [Upcoming requirements for App Store submissions](https://developer.apple.com/news/upcoming-requirements/) — Xcode and SDK minimums, deployment target, privacy manifest reasons, updated age-rating questions, EU trader status (checked 2026-11-16)
3. [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/) — nutrition labels (not re-fetched this pass)
4. [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations) — export compliance (not re-fetched this pass)
5. [TestFlight](https://developer.apple.com/testflight/) — beta testing (not re-fetched this pass)
6. [Testing in-app purchases with sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox) — sandbox testers (checked 2026-11-16 via research note 5)
