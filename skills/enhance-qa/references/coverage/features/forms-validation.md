---
module: forms-validation
kind: feature
title: Forms and validation
checked: 2026-11-16
---
# Forms and validation

Any screen where people type or choose data and submit it: sign-up, checkout, profile, settings, search boxes, wizards, command forms in native apps. Focus: client and server agreeing, clear errors, no lost input, safe repeat submits. Generic empty, boundary and long-text checks are in `base.md`. Usually goes with `accounts-auth.md`, `i18n-rtl.md`, `accessibility.md` and `security.md`.

## Signals

- `<form>`, `react-hook-form`, `formik`, `zod`, `yup`, `vee-validate`, `Angular Forms`, Rails or Django form classes, `FluentValidation`, native input controls with validators.
- Multi-step flows: wizard, stepper, onboarding, checkout.
- Input types: email, tel, date, number, address, file.

## Kickoff questions

1. Which forms matter most (signup, checkout, a main create form)? (best guess: signup plus the main create form)
2. Which countries and languages must addresses, phones and names support? (best guess: the home market plus a few international samples)
3. Is there a spec for validation rules or error copy? (best guess: no, treat the UI hints as the claim)

## Drivers

1. **HTTP client against the form's API endpoint.** Best for client and server parity. Send each bad value directly, skipping the browser, and compare to what the UI allowed or blocked.
2. **Playwright.** Fills fields, submits, reads the accessibility tree for error text and `aria-invalid`, tabs through for order. Observe with scoped snapshots of the form only.
3. **Property or table-driven input lists.** A file of nasty strings (empty, spaces, long, unicode, RTL, quotes, angle brackets, SQL-like, emoji) run through the HTTP client and checked for 4xx, not 500s.
4. **Browser autofill and password managers.** Check with Chrome autofill profiles in a test browser profile; never real saved cards or identities.
5. **Native UI automation** (UI Automation, XCUITest, Espresso, Appium) for desktop and mobile forms; read control values and error labels by accessibility ID.

**Can't be driven here:** screen reader announcements (human or device), on-screen keyboard behavior on real phones, IME input for Chinese, Japanese and Korean on real devices, and address autofill from a real wallet.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | the main form: valid submit, then one invalid submit |
| check | smoke, plus each changed form with valid, invalid and empty input |
| full | every form x client and server path x desktop and phone width x keyboard-only |
| release | all forms, locales, autofill, multi-step interruptions, human review of copy |

Dimensions: field type, valid/invalid/empty, client vs server, browser, input method (typing, paste, autofill), locale, viewport width.

## Check catalogue

### Client and server parity
- [high · auto] For each field, send values the UI blocks (too short, too long, wrong format, missing) straight to the endpoint → server rejects each with 4xx and a field-level error, never 500 and never saves {smoke} {security}
- [high · auto] Send values the UI accepts but the server may not (max length edge, unicode, leading spaces) → accepted values are stored identically; rejected ones give a readable error in the UI
- [medium · auto] Extra or missing fields, wrong types (string for number, array for string) in the request → ignored or rejected cleanly
- [medium · agent] Disable JavaScript or remove `required`/`maxlength` attributes in devtools, then submit → the server still validates
- [medium · agent] Client and server messages for the same rule → say the same thing (not "invalid" on one and "must be 8+ characters" on the other)

### Required, optional and defaults
- [high · agent] Submit with every required field empty → each required field is flagged, focus moves to the first problem, nothing is saved {smoke}
- [medium · agent] Required marking → the UI marks required or optional consistently and in text, not by colour or an asterisk alone {a11y}
- [medium · agent] Optional fields left empty → saved as empty, not "null", "undefined" or a default that surprises
- [medium · agent] Defaults and placeholders → placeholder text is never submitted as a value; pre-filled values can be cleared

### Formats
- [medium · agent] Email: `a@b`, `a@b.c`, `a b@x.com`, `a@x..com`, plus tag, unicode local part, 254+ characters → consistent accept/reject; a valid plus-tagged address is accepted
- [medium · agent] Phone: with spaces, dashes, brackets, `+` country code, letters, too short, too long → accepted formats are normalized for storage; the field accepts international numbers if the product serves them
- [medium · agent] Postcode and ZIP: US, UK, Canadian, Indian PIN, Irish Eircode (with and without space), a country with no postcodes → pattern matches the selected country; a hard-coded US-only rule rejects real addresses
- [medium · agent] Dates: leap day, 31 Feb, year 0 and 9999, past and future limits, day-month order for the locale, native picker vs typed → right value stored; no off-by-one day across time zones
- [medium · agent] Numbers and money: comma vs dot decimal separators, thousands separators, negative, `1e3`, very large, 0.1+0.2 style rounding → parsed per locale; displayed totals add up
- [medium · agent] Names: single name, apostrophes (O'Brien), hyphens, accents, CJK, very long, titles, no-space names → accepted; not forced to "first and last"
- [medium · agent] URLs, usernames, slugs: reserved words, spaces, uppercase, unicode lookalikes → clear rule; uniqueness check is case-insensitive where it should be
- [medium · agent] Passwords: see `accounts-auth.md`; also paste is allowed and a show/hide toggle works {a11y}
- [medium · agent] Rich text and markdown fields: scripts, HTML, long pasted content from Word or web → sanitized on output; formatting survives or is stripped consistently {security}

### Errors: placement, wording, timing
- [high · agent] Error messages sit next to the field, say what is wrong and how to fix it, and are tied to the field programmatically (`aria-describedby`, `aria-invalid`) → screen readers can find them {a11y}
- [medium · agent] An error summary at the top for long forms, with links that jump to each field → links focus the right field {a11y}
- [medium · agent] Timing: no errors on the first keystroke or on an untouched field; errors clear as soon as the value is fixed → no red form before the user has typed
- [medium · agent] Server-side error after a valid-looking submit (duplicate email, name taken) → shown on the right field, not a generic banner only
- [medium · agent] Error and success are never shown by colour alone; contrast of error text is enough {a11y}
- [medium · agent] Field-level and form-level failure of the service (500, timeout) → form says to try again, keeps input, and offers retry

### Preserving input
- [high · agent] Submit with a server error, with a validation error, and after a timeout → all typed values stay (except passwords and card numbers, which may reasonably clear) {smoke}
- [medium · agent] Back button, refresh and returning from another tab mid-form → data kept where the product promises a draft; no stale resubmission prompt that duplicates a record
- [medium · agent] Session expires while filling a long form (see `accounts-auth.md`) → sign in again and the draft survives, or the user is told

### Autofill, paste and input aids
- [medium · agent] `autocomplete` attributes (`email`, `given-name`, `postal-code`, `one-time-code`, `new-password`, `cc-number`) → browser fills the right fields, in the right order {a11y}
- [medium · agent] Paste formatted values (card number with spaces, phone with brackets, text with trailing newline) → accepted or normalized
- [medium · agent] Mobile: right keyboard per field (`inputmode`, `type=tel`, `email`), no zoom on focus, fields not hidden behind the keyboard → every field can be reached and seen
- [low · agent] Input masks and auto-formatting (phone, card, date) → don't fight the cursor; backspace and mid-string editing work

### Multi-step forms
- [high · agent] Go forward, back and forward again, change an earlier answer → later steps update or warn; nothing is silently lost {smoke}
- [medium · agent] Progress indicator → step count and current step right; completed steps can be revisited
- [medium · agent] Skip a step by URL → blocked or sent back to the first missing step
- [medium · agent] Reload at step 3 → state restored or restarted with a clear message
- [medium · agent] Final review step shows every answer correctly; Edit links go to the right step and return

### Unsaved changes and double submit
- [medium · agent] Edit a field, then navigate away, close the tab or click Cancel → a warning appears only when there are real unsaved changes; none after saving
- [high · agent] Double-click Submit, press Enter twice, and submit on a slow throttled network → one record; the button is disabled or shows progress while sending {smoke}
- [medium · agent] Submit, then press Back and Submit again, or refresh the result page → no duplicate; a safe message or redirect
- [medium · agent] Cancel mid-submit (navigate away or kill the connection) → the result is either saved once or not at all, never half

### Accessibility and interaction
- [medium · agent] Tab through the form → logical order, visible focus, labels on every control (not placeholder only), Enter submits, Esc closes dialogs {a11y}
- [medium · agent] Zoom to 200% and 320px width → no clipped fields or overlapped error text {a11y}
- [low · agent] Disabled submit buttons → a reason is given; a disabled button without explanation is avoided {a11y}

## Gates

- Server validates every rule the UI shows; no 500 on bad input.
- Double submit makes one record.
- Errors are field-level, readable, and associated with their fields.
- Input survives errors.

## Human-only checks

- [human] Screen reader pass (NVDA or VoiceOver) through the main form with an error → errors are announced and the user can fix them without sight of the screen
- [human] Fill the form on a real phone with the on-screen keyboard and autofill → no field hidden by the keyboard; keyboards match fields
- [human] Read the error copy aloud → polite, specific, never blaming the user

## Known pitfalls

- **Browser validation bubbles differ** by browser and language; the wording isn't a product bug unless the product relies on it.
- **Disabled-until-valid buttons** can look like "button does nothing" to an agent; check the field state first.
- **Autofill colours and prefilled values** can make fields look filled to an agent while the framework state is empty; trigger an input event or type to confirm.
- **Strict email regexes** differ from the standard; only report ones that reject real, common addresses.
- **Debounced validation** shows errors after a short delay; wait before judging.
- **Honeypot and CAPTCHA fields** are invisible on purpose; don't fill hidden fields.
- Don't submit forms that send real messages, real orders or real payments; use test mode and the catcher.

## Sources

1. [W3C WAI: Form validation and error messages (WCAG tutorial)](https://www.w3.org/WAI/tutorials/forms/validation/) — error identification and association (checked 2026-11-16)
2. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — 3.3 input assistance, 1.3.5 identify input purpose (checked 2026-11-16)
3. [MDN: HTML autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) — autofill tokens (checked 2026-11-16)
4. [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) — validate on the server (checked 2026-11-16)
5. [Falsehoods programmers believe about names](https://www.kalzumeus.com/2010/06/17/falsehoods-programmers-believe-about-names/) — name field pitfalls (checked 2026-11-16)
