---
module: privacy-law
kind: gate
title: Privacy law (GDPR, UK GDPR, ePrivacy, CCPA/CPRA, COPPA)
checked: 2026-11-16
---
# Privacy law (GDPR, UK GDPR, ePrivacy, CCPA/CPRA, COPPA)

Legal and documentation gates for personal data. The product checks (banners, consent behaviour, access and deletion flows, children's data in practice) live in `../features/privacy-consent.md`; run that first. This pack adds the questions and documents a release needs. **This is not legal advice.** Privacy law differs by country and state and changes often. The owner or a lawyer decides what applies and signs off the wording. Agents compare what the product does with what the documents say, using test data only. Use with `web-launch.md` (L10), `google-play.md`, `apple-app-store.md` and `age-ratings.md`.

## Signals

- The product collects any personal data: accounts, emails, analytics, cookies, device IDs, payments, location, photos, support chat.
- Users or visitors in the EU, UK, California or other US states, or an audience that includes children.
- Third-party processors: analytics, email, payments, hosting, LLM APIs, error tracking, ad networks.
- A store form asking for a privacy policy or data declarations.

## Kickoff questions

1. Where are the users, and is the audience under 13 (US), or under 16 or lower in the EU and UK, in whole or part? (best guess: read the site locale and audience; ask if children could use it)
2. Which third parties receive personal data, and where are they based? (best guess: list them from the network capture and package list)
3. Who is the contact for privacy requests? (best guess: an email on the privacy page; ask who answers it)

## Drivers

1. **Network capture and cookie inventory** with Playwright: on first visit, after "reject", after "accept", and after sign-in. Lists every request, cookie and storage key with its domain. Read-only and exact.
2. **Code and dependency scan** for SDKs, tracking IDs, data fields and retention settings (database columns, log settings).
3. **Document comparison.** Read the privacy policy, cookie policy and store declarations and compare each claim with the capture and the code.
4. **Test accounts** for access, export and deletion requests. Test data only; never real customers' data.

**Can't be driven here:** legal applicability, lawful-basis decisions, signed data-processing agreements, transfer mechanisms, regulator contact, and a lawyer's review of the text. These are human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | capture before and after consent; documents versus behaviour |
| full | check, plus access, export and deletion on a test account, and a processor list |
| release | full, plus human legal read and sign-off |

Dimensions: visitor region (EU, UK, California, elsewhere), signed in versus out, consent state (none, rejected, accepted), age (adult, under 13).

## Check catalogue

### Scope and records (all regimes)
- [high · human] Write down, per market, which laws apply (GDPR, UK GDPR, ePrivacy rules, CCPA/CPRA and other US state laws, COPPA, others) → one line per market, marked "owner decision, not legal advice"
- [high · agent] List all personal data collected: what, why, where stored, who receives it, how long kept → data map with each item linked to a purpose (needed for lawful basis and for the policy)
- [high · agent] List every processor and third party seen in the capture and dependencies, with country and purpose → no unlisted recipient; each in the policy
- [medium · human] Decide the retention period for each data type and check the product deletes on schedule → period written; a test record is deleted when due

### GDPR and UK GDPR (see Sources 1, 2)
- [high · human] Each purpose has a lawful basis written down (consent, contract, legal obligation, legitimate interests and so on), and the policy states it → recorded per purpose
- [high · agent] Where consent is the basis, check it is a clear opt-in: unticked boxes, separate from terms, as easy to withdraw as to give, not a condition of the service unless needed → pass in test accounts
- [high · agent] Privacy notice at the point of collection covers who the controller is, contact, purposes, bases, recipients, transfers, retention, rights and the right to complain to the regulator → each item present (Articles 13 and 14)
- [high · agent] Data subject rights through the product or a documented route: access, correction, deletion, export, objection and restriction; run an access and a deletion request on a test account → both complete within the stated time (the law sets one month, extendable in some cases) and the data is removed from the app, logs and processors where practical
- [high · human] A data processing agreement is signed with each processor that handles personal data for you (hosting, email, analytics, support) → agreement on file for each
- [high · human] International transfers (data leaving the EU or UK) use a valid mechanism (an adequacy decision, standard contractual clauses or similar) → recorded for each processor in a non-adequate country
- [medium · human] Records of processing, a breach-response plan with contacts, and, where needed, a data protection impact assessment or a Data Protection Officer → documents exist; the owner decides when each is required
- [medium · human] An EU or UK representative is named if the company is outside and targets those markets → recorded where needed

### ePrivacy and cookie consent
- [high · agent] On first visit from an EU or UK location (or with the region simulated), capture all requests before any choice → no analytics, advertising or non-essential cookies and no third-party calls that set identifiers before consent {smoke}
- [high · agent] Click "Reject all" and browse → still no non-essential cookies or trackers; the reject button is as easy to find as accept
- [high · agent] Click "Accept", then change the choice later through a visible link → the choice is stored, honoured on reload and withdrawable
- [medium · agent] Categories in the banner match what the cookie list and the capture show → no mismatch
- [medium · agent] Embedded videos, maps, social buttons and chat widgets don't load tracking before consent (or use a click-to-load placeholder) → none before consent

### CCPA/CPRA and other US state laws (see Sources 3, 4)
- [high · agent] Notice at collection is shown where data is collected and says the categories, purposes, whether they are sold or shared, and retention → present and matches the policy
- [high · agent] If the business sells or shares personal data (including for cross-context behavioural ads), a clear "Do Not Sell or Share My Personal Information" link works, and no sale or sharing happens after opt-out → capture shows ad and tracking calls stop
- [high · agent] Send the Global Privacy Control signal (header `Sec-GPC: 1` or `navigator.globalPrivacyControl`) in a test browser → the site treats it as an opt-out of sale and sharing without asking again (see Sources 5)
- [medium · agent] Rights requests (know, delete, correct, limit use of sensitive data) can be made by a web form or a toll-free or other route, and a test request is tracked → request logged and answered inside the legal time
- [medium · human] Check thresholds and the list of states with comprehensive privacy laws that apply to the business (size, data volume) → owner decision recorded; laws differ state by state and change

### Children (COPPA and similar) (see Sources 6)
- [high · human] Decide whether the product is directed to children under 13, or has actual knowledge it collects their data → written decision; if yes, COPPA applies
- [high · agent] If COPPA applies, check for verifiable parental consent before collecting personal data, a clear parent notice, and parent access and deletion → each present with a test parent account; no behavioural ads or persistent IDs for children beyond what the rule allows
- [medium · agent] A neutral age screen (no hint of the "right" age) where the product is general-audience and wants to treat under-13 users differently → works on a test account
- [medium · agent] Check the children's mode in app stores matches this (see store packs) → declarations agree

### Policy accuracy and documents
- [high · agent] Compare each sentence of the privacy policy with the capture, code and data map → no claim contradicts behaviour (for example "we don't share data" while an ad SDK sends it)
- [high · agent] Policy is dated, versioned, linked from every sign-up form, footer and store listing, and changes are announced where the law needs it → links work
- [medium · agent] Policy is readable: plain language, specific recipients and purposes, no placeholders → no "lorem" or template text
- [high · human] A named contact for privacy requests that is monitored → a test email gets a reply
- [high · human] Owner or lawyer reads the policy, terms, cookie policy and consent texts and signs off → written sign-off

## Gates

For each market: applicable laws recorded; documents match product behaviour; consent works before any non-essential tracking; rights requests work on a test account; processors have agreements and transfer mechanisms; children's rules handled where relevant; a human legal read is complete.

## Human-only checks

- [human] Decide which laws apply, the lawful bases, and the retention periods.
- [human] Sign data processing agreements and choose transfer mechanisms.
- [human] Send an access or deletion request from your own account and an email to the privacy address. Judge: do you get a proper answer in time?
- [human] Have a lawyer read the final documents if the product handles sensitive data or children's data.

## Known pitfalls

- A test-mode or staging site often has analytics off, so a clean capture there doesn't prove production. Capture the real domain.
- Don't call a cookie banner "compliant" because it exists; the test is what loads before and after the choice.
- Essential cookies (login, security, load balancing) need no consent; flagging them isn't a finding.
- The rules differ: GDPR consent rules are not the same as CCPA opt-out rules. Don't apply one to the other.
- Consent banners and GPC behaviour depend on the visitor's region; test the region the law covers.
- Deadlines, thresholds and state laws change. Check the regulator's pages and note the date; here none of the numbers or dates for specific US states are given.
- Don't use real people's data for access and deletion tests.

## Sources

1. [GDPR text, including Articles 13 and 14](https://gdpr-info.eu/) — information at collection and the other GDPR articles (Article 13 checked 2026-11-16 via research note 11; the rest not re-fetched this pass)
2. [ICO guide to UK GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/) — UK GDPR guidance (not re-fetched this pass)
3. [California Attorney General: CCPA](https://oag.ca.gov/privacy/ccpa) — rights, notices, sale and sharing (not re-fetched this pass)
4. Research note 11, section on legal pages: CalOPPA requires a posted privacy policy from commercial sites collecting data from California residents (checked 2026-11-16 via research note 11)
5. [Global Privacy Control](https://globalprivacycontrol.org/) — the opt-out preference signal (not re-fetched this pass)
6. [FTC: Children's privacy (COPPA)](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy) — COPPA basics (not re-fetched this pass)
