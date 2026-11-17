---
module: accessibility-law
kind: gate
title: Accessibility law (EAA, EN 301 549, ADA, Section 508)
checked: 2026-11-16
---
# Accessibility law (EAA, EN 301 549, ADA, Section 508)

Legal and documentation gates for accessibility. This pack does not repeat the technical checks: run `../features/accessibility.md` for those (WCAG 2.2 AA, scans, keyboard, screen reader). Here are the questions of which law applies, which standard to test against, and which documents must exist. **This is not legal advice.** Laws, deadlines and court cases change; the human owner or a lawyer decides what applies. The pack only helps you prepare evidence. Use with `web-launch.md` (L13) and `privacy-law.md`.

## Signals

- The product is sold or offered to consumers in the EU (e-commerce, consumer banking, e-books and readers, messaging or calls, TV and video streaming access, passenger transport booking, or consumer hardware such as phones, computers, payment terminals, ticket machines and ATMs).
- The product is sold to, or used by, US public bodies (federal, state or local), or has US consumers and a public website or app.
- A procurement form, tender or customer asks for a VPAT or Accessibility Conformance Report, an accessibility statement or "WCAG conformance".
- The README or site claims accessibility.

## Kickoff questions

1. Where are the users: EU, UK, US, elsewhere, and are any customers public bodies? (best guess: read the pricing, locale and legal pages; ask if unclear)
2. Is the company a micro-enterprise (fewer than 10 staff and a small turnover) offering services? (best guess: ask; the EAA has a micro-enterprise exemption for services, not for products) (see Sources 1)
3. Is a conformance report or statement already published? (best guess: search the site for "accessibility")

## Drivers

1. **The technical pack.** Run `../features/accessibility.md` and keep its evidence (scan reports, keyboard and screen-reader notes). Exact for scans; judgement for the rest.
2. **Site and repo search.** Look for an accessibility statement page, a feedback or contact route, a VPAT or ACR file, and a link in the footer. Read-only.
3. **Document review (human).** The statement and report are read by the owner or a lawyer.

**Can't be driven here:** legal applicability, enforcement risk, a lawyer's reading, and an official audit or third-party certification. These are human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | statement and feedback route exist; technical pack run on changed pages |
| full | technical pack on every core flow, plus documents compared with the evidence |
| release | full, plus human review of the statement and conformance report |

Dimensions: jurisdiction, product type (web, mobile app, documents, hardware, kiosk), conformance target (WCAG 2.1 AA, 2.2 AA, EN 301 549, Section 508).

## Check catalogue

### Which rules apply (decide first)
- [high · human] Write down, per market, which regime applies: EU European Accessibility Act, UK Equality Act, US ADA (Title II public bodies, Title III places of public accommodation), Section 508 (federal procurement), or none → one line per market in the plan, marked "owner decision, not legal advice"
- [high · human] EAA: check the product type against the covered products and services, and whether the micro-enterprise exemption for services applies → written conclusion; the Directive applies since 28 June 2025 (see Sources 1)
- [medium · human] Check whether the product is hardware, software with a hardware part, documents, or only a website, since each needs different parts of the standard → recorded
- [medium · human] Check any contractual requirements (tender, customer contract, app-store policy) that set a level such as WCAG 2.1 AA → recorded

### Technical reference
- [high · agent] Choose the conformance target and write it in the plan: WCAG 2.1 AA is the current reference for US public-sector rules and the long-standing basis of EN 301 549 v3.2.1; WCAG 2.2 AA is what the technical pack tests, and is a superset for the most part (see Sources 2, 3)
- [medium · human] Check the status of EN 301 549: V4.1.1 (published 2 September 2026) aligns with WCAG 2.2 A and AA, but gives presumption of conformity under the EAA only once cited in the EU Official Journal, which was reported as pending; re-check before relying on it (see Sources 2)
- [high · agent] Run `../features/accessibility.md` for every core flow, then link its evidence → no unresolved critical or serious issue on core flows, or each is on a dated remediation plan
- [medium · agent] Check non-web parts the standard also covers: PDFs and other documents, in-app content, video captions and audio descriptions, authentication without cognitive tests, real-time communication → each is checked or marked n/a with a reason
- [medium · device] For hardware or kiosks: reach, controls, audio and visual output, and tactile cues are reviewed with the real device → recorded by a person

### Accessibility statement and feedback
- [high · agent] An accessibility statement page exists, is linked from every page footer (or the app's settings) and is easy to find → page loads from the home page in two clicks
- [high · human] The statement says the standard used, the conformance level (full, partial or none), the known gaps and their timeline, the date of the last review, and how the statement was prepared (self-assessment or audit) → every item present and true; the EAA also needs information about how the service meets accessibility requirements (see Sources 1)
- [high · agent] A working feedback route (email, form or phone) is on the statement page, and a test message is answered → route works and the reply promises a response time
- [medium · human] An escalation or enforcement body contact is shown where the local law needs it (for example a national authority in an EU country) → present for the markets served
- [medium · human] The statement was updated after the last release that changed UI → date is recent

### Conformance reports and procurement
- [medium · human] If customers ask for a VPAT or Accessibility Conformance Report: fill it from real test evidence, row by row (Supports, Partially Supports, Does Not Support, Not Applicable) with remarks → each row is backed by a test result, and nothing is claimed that wasn't tested
- [medium · human] Section 508 (US federal): check the product against the current 508 standards, which refer to WCAG 2.0 A and AA for web content, and the report reflects that → conclusions match (see Sources 4)
- [medium · agent] Compare the statement, report and marketing text → no claim of "fully accessible" or "WCAG compliant" beyond what the evidence supports

### US ADA specifics
- [medium · human] Public entities (Title II): the DOJ web and mobile app rule requires WCAG 2.1 AA; compliance dates were extended by one year in April 2026 to 26 April 2027 for larger entities and 26 April 2028 for smaller ones; the extension has been reported as challenged in court, so re-check the current dates (see Sources 5)
- [medium · human] Private businesses (Title III): there's no detailed federal web rule; courts and settlements often treat WCAG 2.1 AA as the benchmark → owner decision recorded
- [low · human] State laws and procurement rules (for example California, New York) may add duties → checked by the owner

### Process
- [medium · human] Accessibility is part of the release checklist, with a named owner and a remediation log with dates → owner and log exist
- [medium · agent] Check that third-party widgets (chat, payment, consent banner, embedded video) are reviewed too, because their failures count as yours → listed with results or vendor statements

## Gates

For each market: the applicable regime is written down, the technical pack has been run with no unaddressed critical issues, an accurate statement with a working feedback route is published, and any report promised to customers matches the evidence. A lawyer or the owner signs off the legal reading.

## Human-only checks

- [human] Decide which laws apply and the target level. This is a legal judgement, not a test.
- [human] Read the accessibility statement. Judge: is every sentence true today?
- [human] Send a message through the feedback route from a personal address. Judge: does a person answer in the time promised?
- [human] Have a disabled user or a specialist audit the core flows if the risk is high.

## Known pitfalls

- Automated scanners find only part of the issues. A clean scan isn't "compliant".
- "WCAG 2.2 AA" is not the legal text in most places. The legal reference may still be WCAG 2.1 AA or EN 301 549 v3.2.1; don't claim legal compliance from a WCAG pass alone.
- The EAA rules are national laws in each member state, and enforcement and penalties differ. Don't assume one answer for the whole EU.
- Dates in this area move (EN 301 549 citation, DOJ extension, court challenges). Re-check before every release.
- A statement is evidence of intent, not a defence. False claims are worse than honest gaps.
- Don't copy another company's statement.

## Sources

1. [Directive (EU) 2019/882 (European Accessibility Act)](https://eur-lex.europa.eu/eli/dir/2019/882/oj) — covered products and services, micro-enterprise exemption for services, information duties; applies from 28 June 2025 (the date as stated in the brief; the text was not re-fetched this pass)
2. [Deque on EN 301 549 V4.1.1](https://www.deque.com/fr/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/) and [DWT](https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update) — V4.1.1 published 2 September 2026, aligns with WCAG 2.2, citation in the Official Journal pending (checked 2026-11-16 via research note 2)
3. [WCAG 2.2: what's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) — WCAG 2.2 criteria (checked 2026-11-16 via research note 2)
4. [Section508.gov](https://www.section508.gov/) — US federal accessibility requirements (not re-fetched this pass)
5. [Duane Morris alert on DOJ extension of ADA Title II deadlines](https://www.duanemorris.com/alerts/doj_extends_ada_title_ii_digital_accessibility_deadlines_one_year_0426.html) and other law-firm summaries — DOJ interim final rule of 20 April 2026; secondary sources; confirm in the Federal Register and 28 CFR 35.200 (checked 2026-11-16 via a web search; the primary text was not opened)
6. [ADA.gov web guidance](https://www.ada.gov/resources/web-guidance/) — DOJ guidance on web accessibility (not re-fetched this pass)
