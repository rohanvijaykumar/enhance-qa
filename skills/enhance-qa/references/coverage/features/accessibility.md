---
module: accessibility
kind: feature
title: Accessibility (WCAG 2.2 AA)
checked: 2026-11-16
---
# Accessibility (WCAG 2.2 AA)

Covers WCAG 2.2 level AA for web and the matching platform accessibility features on mobile and desktop. Automated scanners catch only part of the problems; this pack pairs scans (auto) with agent-driven keyboard and structure checks and with human screen-reader checks. For legal requirements (European Accessibility Act, ADA) see `../gates/accessibility-law.md`. Goes with every UI platform module.

## Signals

- Any product with a UI: always on for web, mobile and desktop UIs. Strongest when the README or store page claims accessibility, the product sells in the EU or to public bodies, or the audience includes disabled people.
- Dependencies: `axe-core`, `@axe-core/playwright`, `jest-axe`, `pa11y`, `lighthouse`, `eslint-plugin-jsx-a11y`, Android `accessibility-test-framework`, `XCTest` audits.
- Existing `aria-*` attributes, `role=`, `contentDescription`, `accessibilityLabel`, `AutomationProperties`.

## Kickoff questions

1. Is a formal level required (WCAG 2.2 AA, EN 301 549, Section 508)? (best guess: WCAG 2.2 AA)
2. Which assistive tech matters most (screen readers, switch, voice control, magnifier)? (best guess: NVDA or VoiceOver plus keyboard only, browser zoom)
3. Is a person available to do the screen-reader pass? (best guess: yes, at release only)

## Drivers

1. **Automated scanners.** Cheapest and most reliable for what they cover. `axe-core` via `@axe-core/playwright` (or the `axe` CLI), Lighthouse accessibility category (`lighthouse <url> --only-categories=accessibility --output=json`), and `pa11y`. Run on each distinct page or state (logged out, logged in, modal open, error state, empty state), not only the home page. Treat `violations` as findings and `incomplete` (needs review) as agent or human work. Limit: Deque's own study found automated rules catch about 57% of issues by volume; the rest needs manual checks.
2. **Playwright keyboard and accessibility-tree driving.** Tab through the flow with `page.keyboard.press('Tab')`, read focus with `document.activeElement`, and read the scoped accessibility tree (`page.accessibility`/aria snapshot) for names, roles and states. Cheap: snapshot only the region under test. Use `page.emulateMedia({reducedMotion:'reduce', forcedColors:'active', colorScheme:'dark'})` and `page.setViewportSize({width:320,height:256})` for reflow.
3. **Platform inspectors and audits.** iOS: Xcode Accessibility Inspector (audit tab), `performAccessibilityAudit()` in XCUITest, Dynamic Type and VoiceOver in Simulator. Android: Accessibility Scanner (device), `AccessibilityChecks.enable()` in Espresso, Layout Inspector, TalkBack on an emulator with Google APIs. Windows: Accessibility Insights for Windows, Narrator. macOS: Accessibility Inspector, VoiceOver Utility. Limits: the scanners find missing labels and small targets, not whether the spoken result makes sense.
4. **Static lint.** `eslint-plugin-jsx-a11y`, `axe Linter`, Android Lint accessibility checks. Fast first pass; no runtime state.
5. **Human with assistive tech.** NVDA or JAWS on Windows with Firefox or Chrome, VoiceOver on macOS and iOS with Safari, TalkBack on Android with Chrome, voice control, switch access.

**Can't be driven here:** the spoken screen-reader experience (an agent can read the accessibility tree but not hear whether the sequence is sensible), VoiceOver rotor and TalkBack gestures on real devices, switch access, voice control, real magnifier use, cognitive load, and whether alt text and labels are meaningful to a person. These are human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | axe scan of the main page and the top flow's first form; keyboard Tab through that flow |
| check | Smoke, plus every changed page: scan, keyboard, 200% zoom |
| full | Every distinct page and state × (scan, keyboard, 200% and 400% zoom or 320px width, reduced motion, forced colours, dark mode) |
| release | Full, plus screen-reader passes on the top 3 flows and a mobile pass with VoiceOver or TalkBack |

Dimensions: page/state, input (keyboard, pointer, touch), zoom and text size, colour scheme, motion preference, screen reader and browser pairing.

## Check catalogue

### Automated scans
- [high · auto] axe-core on every page and state in scope (logged in and out, modals open, error and empty states) → zero violations of impact serious or critical; other violations listed with selectors {smoke} {a11y}
- [medium · auto] Lighthouse accessibility category on key pages → score is recorded as a baseline and doesn't drop between builds; a score of 100 is not proof of conformance {a11y}
- [medium · auto] `pa11y` or a second engine on the same pages → disagreements noted; findings axe missed are added {a11y}
- [medium · auto] axe `incomplete` results → each one is reviewed by an agent or human and closed as pass, fail or "needs human" {a11y}
- [medium · auto] Platform audit: `performAccessibilityAudit` (iOS), Espresso `AccessibilityChecks` (Android), Accessibility Insights FastPass (Windows) → no errors on top screens {a11y}
- [low · auto] Lint rules for accessibility in the build → pass, or the failures are recorded as the baseline {a11y}

### Keyboard (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11)
- [high · agent] Complete the main flow with the keyboard only (Tab, Shift+Tab, Enter, Space, arrows, Esc) → every action is possible; no mouse needed {smoke} {a11y}
- [high · agent] Tab order → follows the visual and logical order; no element jumps focus to an unexpected place {a11y}
- [high · agent] Focus indicator on every focusable element → visible (at least 2 CSS px, contrast against its background), never removed with `outline: none` without a replacement {a11y}
- [high · agent] Keyboard trap: Tab into every modal, menu, date picker, rich-text editor and embedded widget → you can leave with the keyboard (Esc or Tab); nothing traps focus except an open modal (which must trap and release correctly) {a11y}
- [medium · agent] Modal opens → focus moves into it; Esc closes; focus returns to the trigger; the page behind isn't reachable {a11y}
- [medium · agent] Focus not obscured (2.4.11): Tab through pages with sticky headers, cookie banners and chat widgets → the focused element is not fully hidden behind them {a11y}
- [medium · agent] Skip link or landmark navigation on multi-section pages → a "skip to content" link appears on focus and works; landmarks (`main`, `nav`, `header`, `footer`) exist {a11y}
- [medium · agent] Custom controls (tabs, accordion, combobox, slider, tree) → follow the ARIA Authoring Practices key patterns (arrows within, Tab between) {a11y}
- [medium · agent] Single-key shortcuts (2.1.4) → can be turned off, remapped or only work on focus {a11y}
- [medium · agent] Dragging movements (2.5.7): every drag-and-drop or slider has a single-pointer alternative (buttons, click-to-move, input box) {a11y}
- [low · agent] Hover and focus content (1.4.13): tooltips and popovers → dismissable with Esc, stay while hovered, don't vanish before they can be read {a11y}

### Names, roles, states and structure (screen-reader basis)
- [high · agent] Accessibility tree of each page → every interactive element has an accessible name that matches its visible label (2.5.3 Label in Name); no "button" or "link" with no name {a11y}
- [high · agent] Images → informative ones have meaningful alt text (not "image", "photo.png" or the file name); decorative ones have `alt=""`; icon-only buttons have names {a11y}
- [high · agent] Form fields → each has a programmatic label (not just placeholder); required, invalid and disabled states are exposed (`required`, `aria-invalid`, `disabled`) {a11y}
- [medium · agent] Headings → one `h1`, logical order, no skipped levels used for styling; headings describe sections {a11y}
- [medium · agent] Lists, tables and landmarks → use real elements; data tables have header cells (`th` with `scope`); layout isn't done with tables {a11y}
- [medium · agent] ARIA use → no invalid roles, no `aria-hidden` on focusable content, no redundant roles; first rule of ARIA: native elements first {a11y}
- [medium · agent] Dynamic updates (toasts, loading results, form errors, counters) → announced via `role="status"`, `role="alert"` or `aria-live`, not silent; not so chatty that every keystroke is read {a11y}
- [medium · agent] Page title and language → each page/route has a unique descriptive `<title>`, `<html lang>` is set, and the title changes on SPA navigation {a11y}
- [medium · agent] Links → purpose is clear from the text (not "click here"); links that look like buttons and buttons that look like links use the right element {a11y}
- [medium · agent] SPA route change → focus moves to the new content or heading, or the change is announced {a11y}
- [low · agent] Language changes inside the page (quotes in another language) → `lang` attribute on the fragment {a11y}

### Contrast and colour (1.4.1, 1.4.3, 1.4.11)
- [high · auto] Text contrast → at least 4.5:1 for normal text and 3:1 for large text (18pt or 14pt bold), in light, dark and any high-contrast theme {a11y}
- [medium · auto] Non-text contrast → 3:1 for input borders, icons, focus rings, chart lines and state indicators against their neighbours {a11y}
- [medium · agent] Information not conveyed by colour alone → errors, links in text, chart series, required fields also use text, an icon or a pattern {a11y}
- [medium · agent] Text over images, gradients and video → contrast holds at the worst point; screenshots at 1280×800 reviewed for the few worst cases {a11y}
- [medium · agent] Forced colours / Windows High Contrast (`forcedColors: 'active'`) → controls, borders and focus remain visible; icons don't vanish {a11y}
- [low · agent] Dark mode and `prefers-contrast: more` → each has its own contrast check, not only light {a11y}

### Text resize, reflow and spacing (1.4.4, 1.4.10, 1.4.12)
- [high · agent] Browser zoom to 200% and 400% (or viewport 320 CSS px wide) → content reflows to one column, no horizontal scroll for text, nothing clipped or overlapping; two-dimensional content (maps, tables, data grids) may scroll {a11y}
- [medium · agent] Text-only resize 200% and user text-spacing overrides (line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em) → no lost content or clipped text {a11y}
- [medium · agent] Mobile OS large text: iOS Dynamic Type up to the largest accessibility sizes; Android font scale 200% and display size → labels wrap or scale; buttons stay tappable; nothing truncated to meaninglessness {a11y}
- [medium · agent] Orientation (1.3.4) → content works in both portrait and landscape unless essential {a11y}
- [low · agent] Viewport meta doesn't disable zoom (`user-scalable=no`, `maximum-scale=1`) → pinch zoom works {a11y}

### Target size and pointer (2.5.8, 2.5.1, 2.5.2)
- [high · auto] Pointer targets → at least 24×24 CSS pixels, or enough spacing that a 24px circle on each undersized target touches no other target; inline links in text, native browser controls and equivalent controls elsewhere on the page are exempt {a11y}
- [medium · device] On a phone, tap every control in the main flow with a thumb → none are hard to hit; platform guidance (about 44pt on iOS, 48dp on Android) is stricter than the WCAG minimum and is a design target, not an AA failure {a11y}
- [medium · agent] Pointer cancellation (2.5.2): press a button, drag away, release → the action doesn't fire on down; it fires on up over the target {a11y}
- [low · agent] Gestures (multi-finger, path-based) → have single-tap or button alternatives {a11y}

### Motion, time and flashing (2.2.x, 2.3.x, 1.4.2)
- [high · agent] `prefers-reduced-motion: reduce` → large parallax, auto-scrolling, zoom and spinning animations are removed or replaced by fades {a11y}
- [medium · agent] Auto-playing animation, carousel or video over 5 seconds → has a visible pause/stop/hide control {a11y}
- [medium · agent] Audio that plays automatically for over 3 seconds → can be paused or its volume controlled independently {a11y}
- [high · agent] Nothing flashes more than three times per second → verify embedded video and GIFs with a flash analyser or by review {a11y}
- [medium · agent] Session timeouts → warn, allow extension or save data (2.2.1); no data loss on timeout {a11y}

### Multimedia (1.2.x)
- [high · agent] Prerecorded video with speech → accurate captions present and in sync; the player's caption button is keyboard-reachable {a11y}
- [medium · agent] Prerecorded audio → a transcript is offered {a11y}
- [medium · agent] Video with important visuals → audio description or an equivalent text alternative {a11y}
- [low · human] Caption accuracy (names, jargon, speaker changes) → reads correctly {a11y}
- [medium · agent] Live captions where the product streams live events (1.2.4) → present or noted as out of scope {a11y}

### Forms, errors and authentication (3.3.x, 1.3.5)
- [high · agent] Submit invalid data → errors appear in text next to the field, identify the field and the problem, are announced to assistive tech, and focus moves to the first error or a summary {a11y}
- [high · agent] Required fields and formats → instructions are visible before the field, not only after error {a11y}
- [medium · agent] Autocomplete attributes (1.3.5) on name, email, address, password and payment fields → correct `autocomplete` tokens so autofill works {a11y}
- [high · agent] Accessible authentication (3.3.8): log in with paste allowed, password managers working, and no puzzle, transcription or memory test as the only way in → passes {a11y}
- [medium · agent] Redundant entry (3.3.7) → data entered once in a flow is not asked for again, or is pre-filled {a11y}
- [medium · agent] Consistent help (3.2.6) → help, contact or chat appears in the same place across pages {a11y}
- [medium · agent] Destructive or financial submits → can be reviewed, corrected or reversed (3.3.4) {a11y}
- [medium · agent] CAPTCHA → an accessible alternative exists; if not, record it as a finding; agents never solve CAPTCHAs {a11y}
- [low · agent] Input on focus or change doesn't unexpectedly submit or move focus (3.2.1, 3.2.2) {a11y}

### Mobile and desktop native (VoiceOver, TalkBack, Dynamic Type)
- [high · device] VoiceOver on iOS: swipe through the main flow → every control is announced with a sensible name, role and state; reading order is logical; custom gestures have alternatives {a11y}
- [high · device] TalkBack on Android: explore by touch and swipe through the main flow → same expectations; no unlabeled buttons; focus order logical {a11y}
- [medium · agent] Set `accessibilityLabel`/`contentDescription` on icon-only controls; images marked decorative are hidden from the tree → verified in the Accessibility Inspector or the UI hierarchy {a11y}
- [medium · agent] Windows UI Automation tree (Accessibility Insights) → names, control types and keyboard focus for each control in WPF/WinUI/Win32 {a11y}
- [medium · device] Voice control (iOS Voice Control, Android Voice Access, Windows Voice Access, Dragon): "click <visible label>" → works for the main controls {a11y}
- [medium · device] Switch access or external keyboard on mobile → focus order and activation work {a11y}
- [low · device] Bold text, reduce transparency, increase contrast and invert colours (iOS), colour correction (Android) → UI stays legible {a11y}

### Documents and non-web content
- [medium · auto] PDFs and generated documents → tagged, have a title and language, and pass a checker such as PAC or the Acrobat accessibility checker {a11y}
- [low · agent] Emails sent by the product → semantic HTML, alt text, contrast, plain-text part {a11y}

## Gates

- `../gates/accessibility-law.md` for the European Accessibility Act, ADA and public-sector rules.
- Store reviews can reject on basic accessibility failures; see platform gates.
- A conformance claim ("WCAG 2.2 AA") needs the full manual audit; scans alone never justify it.

## Human-only checks

- [human] With NVDA + Firefox (or Chrome) on Windows, listen to the home page and the main flow with the screen off or eyes closed → the headings, links, forms and errors make sense in order.
- [human] With VoiceOver + Safari on macOS or iPhone, repeat the main flow, using the rotor for headings, links and form controls → same result.
- [human] With TalkBack on a real Android phone, repeat → same result.
- [human] Use only voice control or only a switch for one task → the task is possible.
- [human] Read alt texts and labels aloud → each tells the user what the image or control does.
- [human] Use the product at 200% text size on a phone for a normal task → still comfortable.
- [human] Judge the cognitive load: simple language, predictable layout, clear errors → acceptable to a typical user.

## Known pitfalls

- **A clean automated scan isn't conformance.** Report "no automated violations", never "accessible".
- **Don't report third-party widgets' own markup (ad frames, embedded chat) without noting they are third-party.**
- **Contrast checkers flag disabled controls and logos; WCAG exempts both.**
- **Native elements (select, date input, checkbox) are exempt from the 24px target rule when the browser controls the size.**
- **`aria-hidden` content like decorative icons is meant to be absent from the tree.**
- **Duplicate IDs or landmarks flagged by axe in a framework's dev overlay** may vanish in production builds; scan the built site.
- **Shadow DOM and iframes** need scans run inside them; a scan that says zero violations on a page full of iframes proves nothing about them.
- **Agents can't hear a screen reader.** Reading the accessibility tree is a proxy; don't mark screen-reader checks passed from the tree alone.
- **Lab Lighthouse scores vary by a few points per run.** Compare over several runs.
- **Keyboard checks on macOS Safari** need "Press Tab to highlight each item" enabled (or Option+Tab); missing focus there can be a setting, not a bug.

## Sources

1. [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/) — the success criteria cited (checked 2026-11-16)
2. [W3C: Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — 24×24 CSS px and exceptions (checked 2026-11-16)
3. [W3C: What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) — new criteria, 4.1.1 removed (checked 2026-11-16)
4. [Deque: automated testing finds 57% of issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues) — scanner coverage limit (checked 2026-11-16)
5. [Lighthouse overview](https://developer.chrome.com/docs/lighthouse/overview) — accessibility category and CLI (checked 2026-11-16)
6. [WebAIM Million](https://webaim.org/projects/million/) — prevalence of detectable failures, rise linked to AI-assisted coding (checked 2026-11-16)
7. [W3C: ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) — keyboard patterns for custom widgets (checked 2026-11-16)
8. [Apple: Accessibility](https://developer.apple.com/accessibility/) — VoiceOver, Dynamic Type, Accessibility Inspector (checked 2026-11-16)
9. [Android: Accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing) — TalkBack, Accessibility Scanner, Espresso checks (checked 2026-11-16)
