---
module: onboarding
kind: feature
title: Onboarding and first run
checked: 2026-11-16
---
# Onboarding and first run

Covers what a brand-new user meets: sign-up friction, first launch, welcome and tutorial screens, empty states, sample data, permission priming, and re-onboarding after updates. Goes with `accounts-auth.md`, `settings-persistence.md`, `privacy-consent.md`, `camera-mic-sensors.md` (permissions) and `analytics-events.md` (activation funnel). Base-layer empty states are in `base.md`; this pack goes deeper on first-run specifics.

## Signals

- Welcome or intro screens, a setup wizard, a product tour library (`intro.js`, `shepherd`, `driver.js`, `react-joyride`, `Appcues`), a checklist ("Get started: 3 of 5").
- `isFirstLaunch`, `hasSeenOnboarding`, `onboarding_completed` flags in code or storage; a `/welcome` or `/onboarding` route.
- A sign-up flow, email verification, team invites, "import your data".
- Sample or demo data, templates, "skip" buttons.

## Kickoff questions

1. What must a new user do to feel the product works (the "aha" moment), and how long should it take? (best guess: the main task, within 5 minutes)
2. Is there sample data or a demo mode, and may testers create fresh accounts freely? (best guess: yes in staging with test emails)
3. Does the product ask for permissions or data during setup? (best guess: found in the code)

## Drivers

1. **Clean-state launch.** Web: a new Playwright browser context (empty storage), or a private window. Mobile: `xcrun simctl erase <device>` or uninstall/`xcrun simctl uninstall`, `adb shell pm clear <package>` or `adb uninstall`. Desktop: delete the app's data folder (known path from the code) or use a fresh OS user or VM. Always start the first-run checks from a verified clean state.
2. **Playwright (web) and platform drivers.** Playwright for web and Electron; `adb` plus UI Automator/Maestro or Appium for Android; XCUITest or Maestro for iOS (`xcrun simctl` for state); UI Automation for Windows. Observe via scoped accessibility trees; screenshots only for layout of welcome screens at 1280×800 or smaller, and phone width 390px.
3. **Email catcher and test accounts.** Mailpit or the provider's test inbox for verification emails; unique test email addresses per run (`qa+run1@example.test`); never real addresses.
4. **Storage and database inspection.** Read `localStorage`, `UserDefaults`, shared preferences, the app's DB after each step to confirm the onboarding state is saved.
5. **Timer and clock control.** Playwright's clock API or device date changes for time-based nudges (day-3 email, trial reminders).
6. **Human first-time users.** Judging clarity, tone and "would I give up here" needs a person.

**Can't be driven here:** whether the onboarding is clear and motivating to the real audience, tone, and cognitive load; real emails from real providers in the inbox's spam folder; time-based nudges over days without clock control; permission dialogs the OS forbids scripting (a person taps them, see `camera-mic-sensors.md`).

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Clean state, new test account, complete onboarding and reach the main screen |
| check | Smoke, plus skip path, plus the changed step in isolation |
| full | Entry (first launch, sign-up link, invite link, deep link) × path (complete, skip, abandon and return, back) × state (new, upgraded from old version) × device (desktop, phone) × locale |
| release | Full, plus real devices, plus a fresh human user |

Dimensions: entry point, platform, locale, account type (individual, invited team member), permission answers (allow, deny), network (online, offline), previous version installed.

## Check catalogue

### First run and sign-up
- [high · agent] From a clean state, open the product → the first screen explains what it is and the next step; no error, blank screen or leftover test data {smoke}
- [high · agent] Complete sign-up with a new test account and reach the first real screen → fewer steps than the product claims; the user lands where the product says (dashboard, first task) {smoke}
- [high · agent] Count the required fields, screens and clicks before the user can do the main task → only what's needed; optional questions can be skipped; the number is recorded and judged by a human
- [medium · agent] Sign up with email, with each social login offered (sandbox/test provider only), and via an invite link → each lands in the right place; an invited user sees their team, not an empty personal workspace
- [medium · agent] Email verification: the verification email arrives in the catcher, the link works once, an expired link says so and offers a resend → the user can still reach a useful screen or is told why not
- [medium · agent] Sign up with an email that already exists → a helpful path (log in, reset) without revealing sensitive info in a way that contradicts the security policy
- [medium · agent] Returning to the sign-up flow halfway (close the tab, come back via the email link) → resumes at the right step without re-entering data
- [medium · agent] Ask for the minimum personal data → each question has a reason (see `privacy-consent.md`)
- [medium · agent] Sign-up friction extras: CAPTCHA, phone verification, credit card before trial → match the claim ("no credit card needed") {smoke}

### Welcome screens and tutorials
- [high · agent] Skip every intro screen and tour (skip, close, Esc, tap outside) → the product is usable; skipped steps don't block features; a way back to the tutorial exists in help or settings {smoke}
- [high · agent] Go through the tutorial step by step with the keyboard and by pointer → each highlighted element exists, the spotlight points at the right control, and the instructions match the current UI (no stale labels, moved buttons or removed features)
- [medium · agent] Leave the tutorial midway (close the tab, kill the app) and return → it resumes where it was, or restarts clearly; the completion flag is saved only when finished or deliberately skipped
- [medium · agent] Do the step the tutorial asks in a different order, or do the action before the tour reaches it → the tour adapts or skips ahead; it doesn't stay stuck on a step already done
- [medium · agent] Replay the tour from help → works from any state; doesn't create duplicate sample data
- [medium · agent] Small screens, large text and zoom 200% → tour tooltips don't cover the control they describe, and don't run off-screen {a11y}
- [medium · agent] Screen reader and keyboard: tour popovers are announced, focus moves into them and back, Esc closes → true {a11y}
- [low · agent] Tutorials in the product's other languages and in RTL → complete and positioned correctly (see `i18n-rtl.md`)
- [medium · agent] Welcome screens never reappear after completion on the same account, on reload, on a new device (if the flag is server-side) or after an update → true as claimed

### Empty states and first value
- [high · agent] Brand-new account on every main screen (home, lists, search, reports, settings, notifications) → each shows a helpful empty state with a clear first action; no blank page, "undefined", broken charts (NaN, empty axes) or errors from zero data {smoke}
- [medium · agent] Primary call-to-action in the empty state → works and leads to the first piece of content; after creating it, the empty state is replaced
- [medium · agent] Delete everything back to empty → the empty state returns (not a stuck loading state or a "no results" message that blames the search)
- [medium · agent] Counts, dashboards and progress indicators at zero → show 0 and sensible text; no division by zero, no "-" mixed with "0%"
- [medium · agent] Checklist ("3 of 5 done") → ticks update when the real action is done, not on click; can be dismissed and brought back; progress persists
- [medium · agent] Time to first value: measure steps and minutes from clean install to the main task done → recorded; compare to the product's claim

### Sample data and templates
- [high · agent] Add sample or demo data, if offered → clearly labelled as sample; can be removed in one action; doesn't count in billing, limits or analytics; doesn't leak into real exports or other users' views
- [medium · agent] Templates and examples → each opens, works and matches the current UI
- [medium · agent] Remove sample data, then use the product → no orphaned items, references or counts left over
- [medium · agent] Sample data on a second login, in a team workspace and after a reset → not duplicated
- [medium · agent] Sample data text → no lorem ipsum, real people's names, real brands or offensive content

### Permission priming
- [high · agent] Where onboarding asks for permissions (notifications, camera, location, contacts, tracking) → the explanation comes before the OS prompt and says what the user gets; the OS prompt appears only when the user agrees {smoke}
- [high · agent] Choose "Not now" or deny each permission → onboarding continues; the product works without it; a later, in-context ask is possible
- [medium · agent] Don't ask for everything on the first screen → permissions are requested when needed; at most those the main flow needs
- [medium · device] Permanent deny, then later want the feature → a link to settings explains how; no dead button
- [medium · agent] Notification, marketing and tracking opt-ins → unticked by default where the law needs opt-in (see `privacy-consent.md`)

### Interruptions, offline and errors during setup
- [high · agent] Lose the network during sign-up or setup, then restore → a clear error with a retry; no half-created account; no duplicate account on retry
- [medium · agent] Back button, browser back and refresh at every onboarding step → no lost answers or a broken state
- [medium · agent] Slow network on onboarding screens → loading states; images and videos don't block the "Next" button forever
- [medium · agent] Server error on the final step → the user can retry; the earlier steps' data is kept
- [medium · agent] Two devices: begin on phone, continue on desktop with the same account → the progress is consistent, or the product says it isn't synced
- [medium · agent] Session expiry in the middle of onboarding → asks to sign in again and resumes
- [low · agent] A very long name, emoji, non-Latin text and spaces in sign-up fields → accepted and shown correctly (see `forms-validation.md`)

### Updates and re-onboarding
- [high · agent] Install the previous version, finish onboarding, update to the new build → no onboarding replay for returning users; saved state is respected {smoke}
- [medium · agent] New features announcement ("What's new") → appears once for existing users, can be dismissed, doesn't block; a first-time user doesn't see "new" labels for features they've never known
- [medium · agent] Major change requiring new consent (terms, privacy policy update) → a clear prompt that can be completed; old users aren't locked out without a path
- [medium · agent] A user who skipped onboarding, then upgrades → the tour is still reachable; flags migrated correctly (see `settings-persistence.md`)
- [medium · agent] Reset or "log out and in again" on the same device → no first-run screens for an existing account
- [low · agent] Account deletion followed by a new sign-up with the same email → a true first-run experience

### Analytics and activation (see `analytics-events.md`)
- [medium · agent] Each onboarding step sends one event (viewed, completed, skipped) → counts match what the tester did; a skipped step isn't counted as completed
- [low · agent] Activation definition → the "activated" event fires when the real value moment occurs

## Gates

- Store review often checks that the app is usable without forced sign-up, that permission prompts have honest explanations and that demo accounts are provided for review; see platform gates.
- Privacy and children: see `privacy-consent.md`.

## Human-only checks

- [human] Give the product to someone who has never seen it and watch silently for 5 minutes → where did they hesitate, misunderstand or give up?
- [human] Read all onboarding copy aloud → plain, accurate, appropriate tone for the audience.
- [human] Judge whether the onboarding is too long, too pushy, or too cute for this product.
- [human] Check onboarding emails in a real inbox for spam placement, rendering and links (staging mailbox you own) → arrive, look right.

## Known pitfalls

- **Stale state hides first-run bugs.** A browser that remembers a flag skips the tour; always verify a clean state, and say how.
- **Sample data left by earlier test runs** makes an empty state impossible to see; use a fresh account for each pass.
- **Social login in automation** often triggers CAPTCHAs or blocks; use the provider's test mode or a human step. Agents don't solve CAPTCHAs.
- **Email deliverability in staging** isn't the product's fault if the catcher received it.
- **Tour libraries may hide targets in headless mode** if elements load late; wait for the target before judging.
- **Don't file "too many steps" as a defect without the claim.** Record it as a question for the owner.
- **Feature flags** may vary the onboarding by user; note which variant you saw.

## Sources

1. [Apple Human Interface Guidelines: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) — keep it short, defer permission requests (checked 2026-11-16)
2. [Android: Request runtime permissions](https://developer.android.com/training/permissions/requesting) — explain before asking, handle denial (checked 2026-11-16)
3. [Apple Human Interface Guidelines: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) — requesting permission in context (checked 2026-11-16)
4. [W3C: WCAG 2.2, 3.3.7 Redundant Entry and 3.3.8 Accessible Authentication](https://www.w3.org/TR/WCAG22/) — sign-up friction rules (checked 2026-11-16)
5. [Playwright: Browser contexts](https://playwright.dev/docs/browser-contexts) — clean isolated state per run (checked 2026-11-16)
