---
module: privacy-consent
kind: feature
title: Privacy and consent
checked: 2026-11-16
---
# Privacy and consent

Covers whether the product's behaviour matches what it tells people about their data, and whether consent, access, deletion and children's-data rules are met in practice. It checks behaviour, not legal opinion: a lawyer decides what the law requires. The legal detail lives in `../gates/privacy-law.md` (GDPR, UK GDPR, CCPA/CPRA, COPPA and similar); this pack provides the tests. Goes with `analytics-events.md`, `accounts-auth.md`, `security.md` and `data-import-export.md`.

## Signals

- Analytics, ads, tag managers, session replay, error trackers, chat widgets or social embeds: `gtag`, `GA4`, `Segment`, `Mixpanel`, `PostHog`, `Hotjar`, `Meta Pixel`, `Sentry`, `Intercom`, YouTube iframes.
- Cookie or consent library: `OneTrust`, `Cookiebot`, `Klaro`, `cookieconsent`, `iubenda`, a custom banner.
- Sign-up, user profiles, email collection, payments, location, camera/microphone, health or children's content.
- Privacy policy, terms, "Do Not Sell", "Delete my account" pages; EU, UK or California users; an under-13 audience.
- Mobile: App Tracking Transparency, privacy manifests, data-safety forms.

## Kickoff questions

1. Where do the users live, and could any be in the EU, UK or California, or be under 13 (or under 16)? (best guess: yes to EU/UK/California; no children)
2. Which third parties receive data (analytics, ads, payments, email, AI services)? (best guess: found from the code and the network log)
3. Is there a privacy policy to test against, and who is the data controller's contact? (best guess: the policy page on the site)

## Drivers

1. **Playwright network capture in a fresh browser context.** The core driver: open the site with empty storage and no consent clicked, record every request and every cookie/localStorage entry (`context.cookies()`, `page.evaluate(() => ({...localStorage}))`, `page.on('request')`), then repeat after "Accept" and after "Reject". Diff the three runs. Cheap and deterministic.
2. **Cookie and tracker inventory tools.** Browser DevTools Application tab, `playwright` scripts that list cookies with name, domain, lifetime, `Secure`, `SameSite`; open-source scanners such as Blacklight (The Markup) for public sites; `curl -sI` for `Set-Cookie`. Use on your own site only.
3. **Policy-to-behaviour comparison.** An agent reads the privacy policy and cookie table, builds a list of stated data, purposes, third parties and retention, then compares to the observed network log and storage. Judgement on wording is human.
4. **Account flows by script.** Create a test account, then use the product's real "download my data" and "delete account" paths, and verify by API, database (staging), and a second login attempt.
5. **Mobile.** Proxy (mitmproxy with a test device or emulator) or Android `adb logcat`/Charles to see SDK traffic at first launch; iOS Simulator with a proxy; privacy manifest and Info.plist read by script. Limit: pinned certificates may hide traffic.
6. **Human review of wording.** Banner text, dark patterns, policy clarity and legal sufficiency.

**Can't be driven here:** legal sufficiency of any text, whether a lawful basis exists, DPIA and records-of-processing paperwork, international data-transfer mechanisms, and real user requests at scale. Anything involving real people's personal data must not be tested; use test accounts. These become human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Fresh browser context: nothing non-essential fires before consent; the banner can be rejected |
| check | Smoke, plus accept and reject runs on changed pages, plus data export/delete on a test account |
| full | Pages × (no choice, accept all, reject all, partial, withdraw later) × region (EU, UK, California, rest of world if geo-targeted) × device (desktop, phone) |
| release | Full, plus policy comparison, children's-data review, third-party list, human legal review |

Dimensions: consent state, region, account state (anonymous, signed in, child account), device, third parties, language.

## Check catalogue

### Consent banner and choices (GDPR/ePrivacy; UK PECR)
- [high · agent] Fresh context, EU/UK location (or consent mode forced on), no click → a banner appears before any non-essential cookie, script or request fires {smoke}
- [high · agent] Compare "Accept all" and "Reject all": same number of clicks, same prominence, same visual weight, same page level → rejecting is as easy as accepting; no hidden or greyed-out reject, no "manage" as the only route {smoke}
- [high · agent] Click "Reject all" → no analytics, advertising or social cookies, no calls to their domains, and the choice is stored (and respected on reload and across pages)
- [high · agent] Click "Accept all" → the stated trackers start only now; the cookie list matches the banner's categories
- [medium · agent] Granular choices (analytics yes, ads no) → only the allowed categories fire
- [medium · agent] Withdraw consent later (a persistent "Cookie settings" link) → one or two clicks; trackers stop and their cookies are cleared or no longer sent; withdrawing is as easy as giving {smoke}
- [medium · agent] Banner has no pre-ticked boxes, no consent by scrolling or continuing, no dark patterns (confusing wording, fake urgency, trick colours) → true; human judges wording
- [medium · agent] Banner doesn't block reading the whole site (a cookie wall) unless the product states and justifies it → judged by the owner
- [medium · agent] Consent is re-asked on a sensible schedule or when the vendor list changes → matches the policy; not on every page view
- [medium · agent] Banner in every language the site offers; accessible by keyboard and screen reader → true {a11y}
- [low · agent] Consent state sent to the analytics tool (for example Google Consent Mode `denied` defaults) → the tool receives the right signal

### No tracking before consent
- [high · agent] On first load before any click: list every third-party domain contacted and every cookie/storage item set → only strictly necessary ones (session, security, load balancing, the consent record itself); anything else is a finding {smoke}
- [high · agent] Third-party SDKs and tags (analytics, ads, session replay, chat, maps, fonts, video embeds, social buttons) → each is gated by consent or documented as strictly necessary; fonts and embeds loaded from third parties before consent are listed
- [medium · agent] Fingerprinting and pixels (1×1 images, beacons, `navigator.sendBeacon`) fired before consent → none
- [medium · agent] Server-side tracking and logs: IP and user-agent logged with analytics IDs before consent → matches what the policy says
- [high · agent] Mobile first launch: before any consent or sign-in, capture traffic → no advertising ID, device ID or SDK analytics sent until permitted (where the platform or law needs it) {smoke}
- [medium · device] iOS App Tracking Transparency: the prompt appears only when tracking across other companies' apps occurs; denying it stops that tracking

### Cookie and storage inventory
- [high · agent] List every cookie and storage item after accept-all with name, domain, lifetime, purpose and first/third-party → each appears in the product's cookie table or policy; none unexplained
- [medium · agent] Lifetimes → match the stated ones; analytics cookies not set for 10 years without reason; consent cookie lifetime stated
- [medium · agent] Cookie flags → `Secure`, `HttpOnly` (where relevant) and `SameSite` set on session and consent cookies
- [medium · agent] After clearing cookies and revisiting → no ID "respawns" from localStorage, IndexedDB, ETags or fingerprinting
- [low · agent] Cross-site cookies → listed with the provider's purpose

### Privacy policy matches behaviour
- [high · agent] Extract the policy's claims (data collected, purposes, recipients, retention, rights, contact, controller, transfers) and compare to observed requests and storage → every observed collection and every third party is in the policy; anything promised ("we never share data") holds {smoke}
- [high · agent] Policy and notice are reachable from every page and the sign-up form, before data is collected (GDPR Art. 13: at the point of collection) → links present and not broken
- [medium · agent] Policy states retention periods and legal basis where required → present; human judges sufficiency
- [medium · agent] Contact for privacy requests works → a test message or form reaches an inbox (staging mailbox only) and gets an acknowledgement as promised
- [medium · agent] Policy date and version → current; changes after launch are noted; the in-app and web versions agree
- [medium · agent] Store privacy answers (Apple privacy labels, Google Data safety) → match observed data collection; see store gates
- [medium · agent] California: "Do Not Sell or Share My Personal Information" link and opt-out of sale/sharing and Global Privacy Control (GPC) signal → where the product sells or shares data or does cross-context ads, the link exists and a GPC header turns sale/sharing off {smoke}

### Data subject requests: access, export, deletion
- [high · agent] On a test account, use "Download my data" (or the documented request route) → the file arrives within the stated time, is readable, and includes the profile, content, activity and settings the policy says it holds; contains nothing about other people
- [high · agent] "Delete my account" → asks for confirmation; afterwards the user can't log in, the profile and content disappear, and the data is deleted or anonymised in the database, search index, caches, backups-on-schedule, and third-party tools within the stated period; linked records don't leave orphaned personal data {smoke}
- [high · agent] After deletion, sign up again with the same email → a fresh account without the old data
- [medium · agent] Request identity checks → reasonable (logged in or an email check), not a trick to discourage requests; one request doesn't expose another person's data
- [medium · agent] Rectification: edit profile data → changes reach every copy (search, exports, emails)
- [medium · agent] Right to object or restrict and marketing opt-out → unsubscribe link works in one click and is honoured at once; the preference persists
- [medium · agent] Third parties told on deletion (analytics user deletion API, email service, payment provider where required) → the product does it or documents how
- [medium · agent] Data kept for legal reasons (invoices) → stated; the rest removed
- [low · agent] Account inactivity and data expiry rules → work as stated

### Data minimisation and purpose
- [high · agent] Every form field and every API payload → each field has a clear purpose; no unneeded data (date of birth, phone, full address, ID numbers) is collected "just in case"
- [medium · agent] Analytics events and logs → carry no names, emails, free text, tokens or full IP addresses unless justified (see `analytics-events.md`)
- [medium · agent] Error trackers and session replays → mask inputs, passwords and payment fields; no personal data in breadcrumbs
- [medium · agent] Sensitive categories (health, religion, biometrics, precise location, children) → collected only with the stronger consent or protections that the law and the policy describe; human decides
- [medium · agent] Retention: data older than the stated period → deleted or archived by a job; verified on staging with back-dated test data
- [medium · agent] Staging and development copies → contain no real customer data

### Children's data (COPPA and similar)
- [high · agent] If the product targets or knowingly serves under-13s (US COPPA) or under-16s/13s (EU member-state ages): check for an age screen that is neutral (doesn't hint the "right" answer), a parental-consent route before collecting personal data, and no behavioural ads or open chat to minors → matches the claim {smoke}
- [high · agent] A user who enters an under-age birth date → blocked or sent to the parent route; the product doesn't just let them retry with a different date on the same screen
- [medium · agent] Child accounts → analytics, ads, third-party SDKs and data sharing are off or restricted; geolocation, photos and voice aren't collected without parental consent
- [medium · agent] Mixed-audience product with no children's mode → states that it isn't for children and collects no age data it doesn't need; human decides
- [medium · human] Parental access, review and deletion path → exists and works for a test parent

### Sharing, transfers and security of personal data
- [high · agent] Network log on signed-in flows → personal data goes only to the processors named in the policy; no data to ad networks beyond the consent given {security}
- [medium · agent] Data sent to AI services or embedded chat widgets → user content goes only if the policy says so; opt-out works
- [medium · agent] Transfers outside the region (a US analytics host used by EU users) → listed in the policy; human checks the transfer mechanism
- [medium · agent] Data breach plan → exists (contact, 72-hour GDPR notification awareness); human confirms

### Platform and in-product permissions
- [medium · agent] OS permission prompts (location, contacts, camera, notifications) → asked in context with an honest reason, only when needed; a denial doesn't block unrelated features
- [medium · agent] Social login and OAuth scopes → ask for the minimum scopes; the consent screen text matches what the product uses

## Gates

- `../gates/privacy-law.md` lists the laws, their trigger conditions and what a human must confirm.
- Store gates (Apple privacy labels and Google Data safety) cross-check the same collection map.
- Block release on trackers firing before consent in an EU/UK-facing product, a missing working deletion route, or children's data collected without the required route.

## Human-only checks

- [human] Read the banner and policy as a visitor would → clear, honest, no pressure, no jargon.
- [human] Have a lawyer or privacy lead confirm lawful bases, retention and transfers, and sign off the policy.
- [human] Make a real access and deletion request as a staff member using a staff account → completed within the promised time.
- [human] Confirm the controller identity, DPO or privacy contact, and data processing agreements with each processor exist.
- [human] For child-directed products, review the parental-consent method with counsel.

## Known pitfalls

- **Strictly necessary cookies need no consent.** A session cookie, a CSRF token, load-balancer cookies and the consent record are fine before consent.
- **Region matters.** Many banners only show in the EU/UK; a test from a US IP may show none. Force the region (location emulation, the vendor's test mode) before reporting "no banner".
- **Bot and automation detection can skip banners.** Some consent tools hide in headless browsers; check with a normal user agent.
- **A consent tool's own domain call is allowed.** Loading the banner script is not tracking.
- **CCPA/CPRA is opt-out; GDPR/ePrivacy is opt-in.** Don't apply EU rules to a US-only product, or the reverse, without the user's say-so.
- **Consent logs and test data aren't real personal data.** Never use a real person's data for tests.
- **Backups:** deleted data may legitimately remain in rolling backups until they expire; check the policy states it.
- **Don't give legal advice.** Report observations and mark legal conclusions as questions for the owner.

## Sources

1. [GDPR Article 13](https://gdpr-info.eu/art-13-gdpr/) — information to give at the point of collection (checked 2026-11-16)
2. [GDPR text, Articles 7, 12-22](https://gdpr-info.eu/) — consent conditions, access, erasure, objection (checked 2026-11-16)
3. [ICO: Guidance on the use of cookies and similar technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) — UK PECR consent rules (checked 2026-11-16)
4. [California AG: CCPA](https://oag.ca.gov/privacy/ccpa) — rights, opt-out of sale/sharing, GPC (checked 2026-11-16)
5. [FTC: Complying with COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) — under-13 rules, parental consent (checked 2026-11-16)
6. [Global Privacy Control](https://globalprivacycontrol.org/) — the GPC signal (checked 2026-11-16)
7. [Playwright: Browser contexts](https://playwright.dev/docs/browser-contexts) — isolated storage for fresh-visitor tests (checked 2026-11-16)
