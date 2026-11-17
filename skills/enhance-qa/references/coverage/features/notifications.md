---
module: notifications
kind: feature
title: Notifications (email, SMS, push)
checked: 2026-11-16
---
# Notifications (email, SMS, push)

Messages the product sends: transactional and marketing email, SMS, mobile and web push, in-app notices. Test with sandboxes and local catchers only. Real delivery to real people and phones is a human check. Account emails (verify, reset) are tested in `accounts-auth.md`; receipts in `payments-subscriptions.md`; consent law in `privacy-consent.md`. Usually goes with `integrations-webhooks.md` and a mobile or web platform module.

## Signals

- Dependencies: `nodemailer`, `@sendgrid/mail`, `postmark`, `resend`, `mailgun`, `aws-sdk ses`, `twilio`, `firebase-admin` (FCM), `web-push`, `onesignal`, `expo-notifications`, `react-email`, `mjml`, `handlebars` email templates.
- Folders `emails/`, `templates/`, `notifications/`; Service Worker with `push` handler; `UNUserNotificationCenter`; Android notification channels.
- UI: notification settings, bell icon, "unsubscribe", "enable notifications".

## Kickoff questions

1. Which channels send, and what triggers each? (best guess: email for account and activity events, web or mobile push for activity)
2. Is there a catcher or sandbox set up? (best guess: Mailpit for email; the provider's test mode for SMS and push)
3. Do users choose what they get, and are there marketing messages? (best guess: a settings page with per-type toggles; no marketing)

## Drivers

1. **Local email catcher (Mailpit, MailHog, Mailtrap).** Point SMTP at it. Read messages through its web UI or API (Mailpit has a JSON API and `/view/{id}.html`). Check subject, headers, HTML and text parts, links and attachments. Best default for email.
2. **Template previews and linters.** `react-email`, `mjml` and MJML's validator, `html-validate`, link checkers; render the HTML in a headless browser at 600 px width to catch layout breaks.
3. **Provider test and sandbox modes.** Twilio test credentials and magic numbers, SendGrid sandbox mode (`mail_settings.sandbox_mode`), Postmark test server token, SES mailbox simulator addresses. Use them and nothing else for SMS and provider email.
4. **Push test tools.** FCM dry-run (`validate_only`), web push to a test subscription in a browser profile you control, `xcrun simctl push` for iOS simulator payloads, `adb` and Android Studio for notification posting, Firebase console test message to your own test device.
5. **HTTP client and queue inspection.** Trigger events through the API, then check the outbox table, queue and logs; fire the same event twice to test duplicates.
6. **Playwright** for the preferences page, in-app bell, unsubscribe landing pages, and clicking links from the catcher's HTML.

**Can't be driven here:** real inbox placement (spam folder, Gmail and Outlook rendering), real SMS carrier delivery, real push on locked phones and under battery savers, and APNs delivery from iOS simulators (they accept simulated payloads, not real Apple pushes). These are human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | trigger the main notification, see it in the catcher with correct content and a working link |
| check | smoke, plus the notification types the change touched, in their channels |
| full | notification type x channel x user preference x locale x time zone |
| release | all of full, unsubscribe and consent sweep, human delivery and rendering checks |

Dimensions: channel (email, SMS, push, in-app), trigger type, user preference state (on, off, unsubscribed), locale, time zone, device state (foreground, background, killed), client (Gmail, Outlook, Apple Mail, dark mode).

## Check catalogue

### Triggers and content
- [high · agent] Do the action that should notify (comment, invite, order, status change) → exactly one message arrives in the catcher, to the right recipient, within the documented time {smoke}
- [high · agent] Actions that must not notify (own action, muted thread, opted-out, deleted target) → nothing is sent
- [high · agent] Subject, sender name and address, reply-to, and preheader text → right, branded and not "undefined"; sender domain is the product's
- [medium · agent] Personalization (name, amounts, dates, item titles) with long, unicode, emoji, empty and HTML-like values → rendered intact and escaped; no `{{name}}` or "Hi ," left over {security}
- [medium · agent] HTML and plain-text parts → both exist and say the same thing; the text part has working full URLs
- [medium · agent] Images, logos and buttons → load over HTTPS; have alt text; layout survives images turned off
- [medium · agent] Dates, times and currency in message bodies → right format for the recipient's locale and time zone
- [medium · agent] Localized templates → recipient's language chosen from their settings; fallback is sensible; RTL layout is correct (see `i18n-rtl.md`)
- [low · auto] HTML size kept small (Gmail is widely reported to clip long messages at roughly 100 KB; confirm in a test Gmail inbox) and no broken tags → validators pass; no "message clipped" notice

### Links and deep links
- [high · agent] Click every link and button in each template → goes to the right page of the right environment (not localhost or a staging URL in production-like config); needs sign-in if private {smoke}
- [high · agent] Link opened while signed out, signed in as another user, and on a phone → asks for the right sign-in, then lands on the intended item; never shows another user's data {security}
- [medium · agent] One-time and magic links → single use, expire, aren't reusable after forwarding (see `accounts-auth.md`)
- [medium · agent] Link tracking and redirects → the final URL is right; tracking parameters don't break the target; no open redirect {security}
- [medium · device] Tap a notification or email link on a phone with the app installed and not installed → app opens to the item (universal link, app link or custom scheme) or the store/web fallback shows
- [medium · agent] Deleted or moved item behind an old link → friendly message, not a 500

### Unsubscribe and preferences
- [high · agent] Unsubscribe link in marketing and bulk mail → one click or one confirm page; works without signing in; takes effect before the next send; confirmation shown {smoke}
- [high · auto] `List-Unsubscribe` and `List-Unsubscribe-Post` headers on bulk and marketing mail → present and the one-click POST works
- [medium · agent] Turn off a category in settings → no more of that category, still gets the required transactional mail (reset, receipts)
- [medium · agent] Resubscribe; unsubscribe from one type vs all → each does only what it says
- [medium · agent] Preference changes apply across channels and devices; defaults for new users are as documented (opt-in for marketing where law needs it)
- [medium · agent] Unsubscribed or bounced address, then new sign-up with the same address → rules respected; no mail to a suppressed address

### Duplicates, rate limits and retries
- [high · auto] Fire the same trigger event twice (retry, double webhook, double click) → one message, via idempotency or de-duplication
- [medium · auto] Burst of 100 events for one user → batched, digested or rate limited as designed; the user isn't flooded; the catcher shows a sane count
- [medium · auto] Provider fails or times out (stop the SMTP catcher, return 5xx from the sandbox) → retried with backoff; no duplicate when it recovers; permanent failure logged and visible
- [medium · auto] Bounce and complaint webhooks from the provider's test events → address marked, user flagged, no more sends
- [medium · agent] Notification to a user with no email, phone or push token → skipped gracefully; no error loop
- [medium · agent] Per-user and global rate limits for SMS and verification codes → enforced; message tells the user to wait; cost abuse (SMS pumping) is limited {security}

### Time, time zones and quiet hours
- [high · agent] Scheduled notifications (reminder at 9:00, daily digest) with users in different time zones → each at their own local time; test across a DST change and at midnight boundaries using a fake clock
- [medium · agent] Quiet hours or do-not-disturb → no push or SMS in the window; messages are held or dropped as documented; urgent security messages follow the stated exception
- [medium · agent] User changes time zone or travels → next schedule follows the new zone, or the docs say it doesn't
- [medium · agent] Times shown inside messages carry the zone or are in the user's zone ("3:00 PM GMT+1")
- [low · agent] Reminder for an event that was moved or canceled → canceled or updated; no stale reminder

### Push specifics
- [high · agent] Permission prompt → asked in context after a user action, not on first load; denying leaves the app usable and the prompt isn't repeated endlessly {smoke}
- [medium · device] Allow, deny, and later re-enable in OS settings → the app notices the state and shows how to turn it on; token is registered and refreshed
- [medium · agent] Push content: title, body, icon, image, badge count, sound → right, not truncated badly; no sensitive text on the lock screen unless intended {security}
- [medium · device] App in foreground, background and killed → each shows a notification or an in-app banner as designed; the tap routes to the right screen
- [medium · agent] Push after sign-out or account switch on the same device → the old user's pushes stop; tokens are removed from the server {security}
- [medium · device] Android channels and iOS categories → each category is separately controllable in OS settings; names are readable
- [medium · agent] Web push in a browser profile you control → subscribes, receives, and click opens the right URL; unsubscribe works; expired subscriptions are cleaned up

### SMS specifics
- [high · auto] SMS test numbers or magic numbers → send succeeds and fails as the provider documents; failure is handled in the UI
- [medium · agent] Message length and encoding (unicode makes segments shorter), links, sender ID → segments counted, no cut-off links, sender is right for the region
- [medium · agent] STOP and HELP keywords, opt-in record → handled per the provider's and local rules; consent logged
- [medium · agent] Phone number formats and country codes → normalized (E.164); invalid numbers rejected before sending

### In-app notifications
- [medium · agent] Bell and unread count → increments on events; marks read on open; count survives reload and matches the list
- [medium · agent] Realtime update of the bell with a second session (see `realtime-collaboration.md`); mark all read; empty state; very long list pages

### Security and privacy
- [high · agent] Messages never include passwords, full card numbers, tokens in plain text or other users' data; reset links go only to the account's address {security}
- [medium · auto] Email authentication (SPF, DKIM, DMARC) on the sending domain → records exist and align; checked with `dig` or a DNS checker (a staging-domain check; real deliverability is human) {security}
- [medium · agent] Reply handling, and display-name spoofing in user-generated content shown in emails (for example "invite from Admin") → names escaped; the product's own name can't be faked easily {security}

## Gates

- Every template sends once, to the right recipient, with working links.
- Unsubscribe works and is honored; `List-Unsubscribe` present on bulk mail.
- No duplicate sends on retried triggers.
- Push permission is asked in context.
- Human delivery check on real inboxes and devices.

## Human-only checks

- [human] Send each template to your own real mailboxes (Gmail, Outlook, Apple Mail, and a phone client, light and dark mode) → arrives in the inbox not spam; layout and buttons look right
- [human] Receive a real SMS and a real push on your own phone, locked, in battery saver → arrives promptly; tap opens the right screen
- [human] Read each message as a customer → tone, length, clear call to action; nothing that would feel spammy or alarming
- [human] Check sender domain reputation and SPF/DKIM/DMARC with a mail-tester tool before launch → passes with no major flags

## Known pitfalls

- **Catcher is not the inbox.** Spam folders and client rendering quirks can't be judged from a catcher.
- **Delivery delay.** Queues add a few seconds; wait a fixed short time before saying nothing was sent.
- **Dark mode inversions.** Email clients recolor emails; judge only against known client behavior.
- **Provider sandbox modes accept but don't deliver.** "Sent" with no delivery is expected in sandbox.
- **iOS simulator push** won't receive real APNs; use simulated payloads and check logic only.
- **Push permission is sticky.** Once denied, prompts won't reappear; reset the simulator or app data between runs.
- **Timezone tests with real clocks are flaky.** Use a fake or injected clock.
- Never send to real people, real customers' addresses or real phone numbers, and don't blast third-party services to test rate limits.

## Sources

1. [Mailpit](https://mailpit.axllent.org/) — local SMTP catcher, web UI and API (checked 2026-11-16)
2. [RFC 8058: one-click unsubscribe](https://www.rfc-editor.org/rfc/rfc8058) — `List-Unsubscribe-Post` (checked 2026-11-16)
3. [Twilio: test credentials and magic numbers](https://www.twilio.com/docs/iam/test-credentials) — SMS testing without sending (checked 2026-11-16)
4. [SendGrid sandbox mode](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode) — validate without delivering (checked 2026-11-16)
5. [Apple: testing notifications using the Push Notification Console](https://developer.apple.com/documentation/usernotifications/testing-notifications-using-the-push-notification-console) — simulated payloads; for the simulator command run `xcrun simctl push --help` (checked 2026-11-16)
6. [Android: notification channels](https://developer.android.com/develop/ui/views/notifications/channels) — per-category control (checked 2026-11-16)
7. [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — web push (checked 2026-11-16)
8. [Google: email sender guidelines](https://support.google.com/a/answer/81126) — SPF, DKIM, DMARC, unsubscribe for bulk senders (checked 2026-11-16)
