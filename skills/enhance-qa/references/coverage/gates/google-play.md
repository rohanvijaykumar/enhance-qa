---
module: google-play
kind: gate
title: Google Play policy and pre-launch checks
checked: 2026-11-16
---
# Google Play policy and pre-launch checks

Pre-checks for publishing an Android app, Wear OS, TV or Automotive app on Google Play. Agents prepare and pre-check. Play Console forms, uploads, rollouts and the production request are human steps. Use with `../platforms/android.md`, `../features/privacy-consent.md` and `age-ratings.md`.

## Signals

- `build.gradle(.kts)` with an `applicationId`, an `AndroidManifest.xml`, a Flutter, React Native or Expo project with an Android target, or `fastlane supply`.
- The plan names "Google Play", "Play Console", "closed testing" or a `release` pass for an Android app.

## Kickoff questions

1. Is this a new Play developer account, and is it personal or organisation? (best guess: ask; it decides the closed-test rule)
2. Does the app create accounts, use location, SMS, call log, photos, or accessibility services? (best guess: read the manifest)
3. Is there a test account the Play reviewers can use? (best guess: create one in staging)

## Drivers

1. **Static checks on the bundle.** `bundletool` (build-apks, `dump manifest`), `aapt2 dump badging`, Android lint, `./gradlew :app:lintRelease`. Exact; cannot judge policy intent.
2. **Emulator or device with adb.** `adb install`, `adb shell dumpsys package`, `pm grant` and `pm revoke`, `uiautomator dump` for a cheap view tree, screenshots at 1280×800 or less for visual checks.
3. **Play pre-launch report.** Run automatically on a testing-track upload; it uses Firebase Test Lab devices. Agents read it after the human uploads.
4. **Link checker** for privacy policy and account-deletion URLs.
5. **Play Console.** Needs the user's Google login. Agents never type Google credentials.

**Can't be driven here:** the Console, the policy review, the pre-launch devices, real Play Billing purchases, Play Integrity on a locked device. These are gate, device or human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used; this pack runs on `release` passes |
| check | static bundle checks and the declarations block |
| full | all auto and agent lines on a release-signed bundle |
| release | everything, plus device and human lines and a testing-track run |

Dimensions: form factor claimed, minimum and latest Android, fresh install versus update, permission granted versus denied, signed in versus out.

## Check catalogue

### Build and technical requirements
- [high · auto] Build an Android App Bundle (`.aab`), not an APK, for upload → `bundletool validate --bundle=app.aab` succeeds; Play requires bundles for new apps (see Sources 6)
- [high · auto] Read `targetSdkVersion` from the bundle manifest → it meets the current Play target API requirement for the form factor (phone and tablet: API 36 from 31 August 2026; extensions were offered to 1 November 2026; Wear OS and Automotive: API 35) (see Sources 1) {smoke}
- [high · auto] If the app has native code, list the `lib/` folders in the bundle → each 32-bit ABI has a matching 64-bit ABI (arm64-v8a, x86_64) (see Sources 7)
- [medium · auto] The bundle is signed with the upload key and Play App Signing is on; the keystore and password are not in the repo → `apksigner`/`jarsigner` verify passes; secret scan clean {security}
- [medium · auto] Version code is higher than the last uploaded build → Console accepts the upload
- [medium · auto] Run `lintRelease` and fix errors → no errors; warnings reviewed
- [medium · auto] Release build has `android:debuggable` off and no test endpoints or debug keys → `aapt2 dump badging` and a strings grep show none
- [medium · agent] Install the release APK set via `bundletool install-apks` on emulators for the minimum and latest Android → launches, no crash
- [high · agent] Walk the main flows on a release build → no crash, force close or freeze; Play policy bans apps that crash or freeze (see Sources 2)
- [medium · device] Check memory and speed on a low-end real phone → no frequent ANRs; Android vitals bad-behaviour thresholds are 1.09% crash rate and 0.47% ANR rate (see Sources 4)

### Data safety, privacy and account deletion
- [high · agent] Compare the Data safety form draft with what code and SDKs really collect and share (analytics, ads, crash, auth, payments) → each data type is declared with correct purpose, sharing and optional-or-required flags (see Sources 3)
- [high · agent] Privacy policy URL works, is public, not a PDF behind a login, and names the developer or app → matches Data safety answers
- [high · agent] If users can create an account, find an in-app way to delete the account and data, and check a web page where deletion can be requested without reinstalling → both work on a test account; the web link is entered in Play Console (see Sources 5)
- [medium · agent] Deletion flow tells the user about any data kept (legal, fraud) → text matches the privacy policy
- [high · agent] No data is sent before the user consents where consent is required → network capture shows no analytics or ad calls before consent {security}

### Permissions and sensitive declarations
- [high · auto] List every `<uses-permission>` in the merged manifest (`aapt2 dump permissions`) → each is used by a real feature; none left over from libraries without need
- [high · agent] Background location, SMS or call log, all-files access, accessibility service, exact alarms, `QUERY_ALL_PACKAGES`, full-screen intent or VPN: for each one present, find a Play Console declaration and a core-feature justification → declaration drafted and a demo video planned (see Sources 8)
- [medium · agent] Deny each runtime permission → app degrades gracefully with a short rationale; no loop of prompts
- [medium · agent] Check foreground service types and notification permission on the latest Android → declared types match behaviour; app does not crash

### App content declarations
- [high · human] Complete the content rating questionnaire (IARC) with answers that match the real content → rating shown matches the app; see `age-ratings.md`
- [medium · human] Target audience and content, ads declaration, news-app, health, financial-features and government declarations answered truthfully → no declaration left "in progress"
- [medium · agent] If the app is aimed at children, check there are no non-compliant ads or SDKs and no collection beyond what the Families policy allows → pass on a network capture; see `privacy-law.md`
- [medium · agent] Store listing: title, short and full description, icon, feature graphic and screenshots are accurate, with no misleading claims, no ranking text and no other platforms → pass on a manual read
- [medium · agent] Check in-app purchases use Google Play Billing for digital goods and a license tester can buy, cancel and refund → test instruments behave as documented; no real card used (see `../features/payments-subscriptions.md`)

### Testing tracks and pre-launch
- [high · gate] Upload to the internal testing track and install from the Play link on a real device → installs, launches and signs in
- [medium · gate] Read the pre-launch report for the uploaded build → no crashes, no blocking accessibility or security findings; each issue triaged (see Sources 9)
- [high · gate] For a new personal developer account created after 13 November 2023: run a closed test with at least 12 testers opted in for 14 continuous days, then apply for production access → production access granted (see Sources 10)
- [medium · gate] Open testing, if used, requires production access first → track opens
- [high · gate] Submit the production release for review → review passes; done by a human only
- [low · human] Staged rollout starts small and a crash-rate alert is set → the user watches vitals after release

## Gates

Target API level, bundle format, 64-bit, Data safety, account deletion, declarations and a clean pre-launch report block release. Use `../platforms/android.md` for the runtime checks.

## Human-only checks

- [human] Fill the Data safety, content rating and declaration forms in Play Console. Judge: each answer is true for the build you upload.
- [human] Record the demo video for any sensitive-permission declaration. Judge: it shows the feature using the permission.
- [human] Provide a test account and steps in "App access". Judge: a reviewer can reach every feature without help. Test data only.
- [human] Upload the bundle, press the production release and start the rollout.

## Known pitfalls

- Policies and the target API deadline change each year. Re-read the official page; don't trust a number from memory.
- Pre-launch devices can't use your real login. Give them test credentials or script them, or the report is just a login screen.
- Pre-launch warnings about contrast or touch size can be real accessibility issues. Triage them; don't dismiss them as noise or copy them blindly.
- The 12-tester rule applies to some account types only. Check the account first.
- Memory or ANR rates need real traffic. A lab run can't prove them.
- Debug-signed APKs don't match the upload key. Don't compare signatures across them.

## Sources

1. [Target API level requirements for Google Play apps](https://support.google.com/googleplay/android-developer/answer/11926878) — API 36 for phone and tablet from 31 August 2026, extension to 1 November 2026, Wear OS and Automotive API 35 (checked 2026-11-16)
2. [Play developer policy: Android app quality / crashes](https://support.google.com/googleplay/android-developer/answer/9898783) — crash and freeze ban (checked 2026-11-16 via research note 2)
3. [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469) — Data safety form (not re-fetched this pass)
4. [Android vitals](https://developer.android.com/topic/performance/vitals) — bad-behaviour thresholds (checked 2026-11-16 via research note 2)
5. [Understand account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) — in-app path, web link, Data safety entry (checked 2026-11-16)
6. [About Android App Bundles](https://developer.android.com/guide/app-bundle) — bundle format (not re-fetched this pass)
7. [Support 64-bit architectures](https://developer.android.com/google/play/requirements/64-bit) — 64-bit rule (not re-fetched this pass)
8. [Use of background location and other permissions](https://support.google.com/googleplay/android-developer/answer/9799150) — permission declarations (not re-fetched this pass)
9. [Use a pre-launch report to identify issues](https://support.google.com/googleplay/android-developer/answer/9842757) — pre-launch report (checked 2026-11-16 via research note 2)
10. [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465) — closed test, 12 testers, 14 days (checked 2026-11-16)
