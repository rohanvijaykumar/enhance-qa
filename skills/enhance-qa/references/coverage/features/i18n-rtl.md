---
module: i18n-rtl
kind: feature
title: Internationalisation and right-to-left languages
checked: 2026-11-16
---
# Internationalisation and right-to-left languages

Covers products that ship in more than one language or region, or claim to: translation completeness, layout under longer text, plurals, right-to-left (RTL) mirroring, fonts, formats for dates, numbers and currency, time zones, non-Latin input, and sorting. If the product is English-only and says so, still run the "locale-safe" checks (formats, time zones, non-Latin input). Goes with any platform module, `forms-validation.md` and `accessibility.md`.

## Signals

- Locale files or message catalogues: `locales/`, `i18n/`, `*.po`, `*.arb`, `*.xlf`, `strings.xml` in `values-xx/`, `Localizable.strings`/`.xcstrings`, `.resx`, `messages.json` in `_locales/`.
- Dependencies: `i18next`, `react-intl`, `formatjs`, `vue-i18n`, `next-intl`, `gettext`, `flutter_localizations`, `ICU`.
- `dir="rtl"`, CSS logical properties, `Intl.*` calls, a language switcher.
- README or store listing mentions languages, Arabic, Hebrew, Persian, Urdu, CJK, or "global".
- Prices, dates or addresses shown to users from several regions.

## Kickoff questions

1. Which languages and regions does the product claim? (best guess: the locale files that exist; include one RTL language if the product claims any)
2. Who supplies translations (human, machine, a vendor), and is any language incomplete on purpose? (best guess: machine-translated, some gaps allowed)
3. Does the product handle money, dates for appointments, or addresses? (best guess: yes if there's checkout or scheduling; then the format and time-zone checks are high risk)

## Drivers

1. **Static checks on message catalogues.** Best and cheapest. Run the project's own lint (`i18next-parser`, `formatjs lint`, `eslint-plugin-i18next`, `msgfmt -c`, `lint` for Android `MissingTranslation` and `ExtraTranslation`). Diff keys between the source locale and each other locale, check placeholders (`{name}`, `%s`, `%1$d`) match in each, and check ICU plural syntax parses. No UI needed.
2. **Pseudo-locales.** Android pseudolocales `en-XA` (accents, expansion, brackets) and `ar-XB` (RTL), enabled in developer options or via `adb shell setprop persist.sys.locale`/Settings. iOS: scheme option "Double-Length Pseudolanguage" and "Right-to-Left Pseudolanguage" under Run > Options. Web and others: generate a pseudo-locale (for example `pseudo-localization` npm package or the app's i18n tooling): accent the letters, pad by 30-40%, wrap in brackets. Unbracketed text on screen means a hard-coded string.
3. **Browser automation with locale emulation.** Playwright `locale`, `timezoneId`, and `extraHTTPHeaders: {'Accept-Language': ...}` per context; `page.emulateMedia`. Run the main flow in 3 to 4 locales (source, a long one such as German, an RTL one, a CJK one). Observe with the scoped accessibility tree for text, and screenshots at 1280×800 or smaller for layout checks only.
4. **Simulator and emulator locale switch.** `xcrun simctl` with the `-AppleLanguages (ar)` launch argument; `adb shell` locale change on newer Android, or the in-app per-app language setting. Limit: some OS-wide formats only change after a restart.
5. **Human reviewer fluent in the language.** Agents can't judge whether a translation reads right (see below).

**Can't be driven here:** whether translations are correct, natural and culturally fine; whether RTL feels right to a native reader; font quality in a script the agent can't read; IME composition on a real phone keyboard. These are human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Source locale plus one other locale: the main screen loads with no raw keys (`home.title`) |
| check | Smoke, plus the RTL locale and the pseudo-expanded locale on the changed screens |
| full | Pairwise over locale (source, long, RTL, CJK, one with a different number system) × region (formats) × time zone (UTC, +14, -12, one with DST) × screen |
| release | Every claimed locale on the top flows, plus human review of translation and RTL |

Dimensions: language, region, script direction, number system, calendar, time zone, device text size, font fallback, input method.

## Check catalogue

### Translation completeness
- [high · auto] Compare keys across all locale files → every key in the source locale exists in each claimed locale, or the gap is listed as intentional {smoke}
- [high · auto] Compare placeholders and variables per key → each translation has the same placeholders, with none missing, renamed or doubled
- [medium · auto] Find keys present in locale files but unused in code, and the reverse → no dangling keys; no code key without a source string
- [high · agent] Switch to each claimed language and walk the main flows → no raw keys, no source-language text left over (check buttons, toasts, validation errors, empty states, emails, page titles, `aria-label`s, tooltips)
- [medium · agent] Server-side messages (API errors, emails, PDFs, push text) → localised the same way as the UI, or documented as English-only
- [medium · agent] Fallback: request an unsupported locale (`xx-YY`) → falls back to the source language with no crash and no raw keys
- [medium · agent] Same word translated differently across screens (for example "Save" vs "Store") → consistent terms from a glossary if one exists
- [low · human] Brand names, legal names and proper nouns → left untranslated where they should be
- [medium · agent] Concatenated strings (`"You have " + n + " items"`) found in code or the pseudo-locale → none; sentences come whole with placeholders, so word order can change

### String expansion and layout
- [high · agent] Pseudo-expanded locale (30-40% longer) on every main screen → no truncation without ellipsis and tooltip, no overlap, no clipped buttons, no horizontal scroll {smoke}
- [medium · agent] German-style long compound words and long unbroken strings in titles and buttons → wrap or truncate gracefully
- [medium · agent] Short scripts (CJK) → no big empty gaps; line height not too tight for tall glyphs
- [medium · agent] Fixed-width or fixed-height containers, tables and nav bars in an expanded locale → still usable; menus don't wrap off-screen
- [medium · agent] Text in images, icons with words, and screenshots in marketing pages → localised or free of text
- [low · agent] Text resize (200%) combined with the long locale → still reachable, no clipping

### Plurals and grammar
- [high · agent] Counts 0, 1, 2, 3, 5, 11, 21, 100, 1.5 in each language shown in the UI → the right plural form for each (Arabic has six forms, Russian and Polish have several, Japanese has one); no "1 items", no "(s)" hacks
- [medium · auto] ICU/CLDR plural rules in the catalogue define every category the language needs (`zero, one, two, few, many, other`) → no missing form
- [medium · human] Gender, case and formality in translations (for example "Du" vs "Sie") → consistent and acceptable to a native speaker
- [low · agent] Ordinals ("1st", "2e") and lists ("A, B and C") → use locale rules, not string joins

### Right-to-left
- [high · agent] Switch to Arabic or Hebrew (or the `ar-XB` pseudo-locale) → the whole layout mirrors: navigation, sidebars, progress bars, back arrows, text alignment, form labels, carousels, sliders {smoke}
- [high · agent] Directional icons (back, forward, send, undo) → mirrored; non-directional icons (play, clock, checkmark, logos, phone) → not mirrored
- [medium · agent] Numbers, URLs, email addresses, code and Latin brand names inside RTL text → stay readable in the right order (bidi isolation, `<bdi>` or `dir="auto"`)
- [medium · agent] Mixed-direction user input (Arabic text with an English name; an email field; a phone number) → the caret, selection and display behave; punctuation doesn't jump to the wrong end
- [medium · agent] `dir`/`lang` attributes and `<html lang>` → set correctly per page and per quoted fragment; screen readers pick the right voice
- [medium · agent] CSS uses logical properties (`margin-inline-start`) rather than left/right where mirroring is expected → verified by the layout in RTL, not by grep alone
- [low · agent] Animations and swipe directions in RTL → follow the reading direction
- [medium · agent] Charts, tables and timelines in RTL → the axis and column order are mirrored where convention says so; numeric axes stay LTR

### Fonts and rendering
- [high · agent] Scripts the app claims (Arabic, Devanagari, Thai, CJK, Hebrew, emoji) rendered in headings, body, inputs and PDFs → no tofu boxes (□), no question marks, no missing glyphs {smoke}
- [medium · agent] Font fallback when the brand font lacks a script → a system font steps in with acceptable size and weight
- [medium · agent] Arabic shaping and ligatures, Thai and Devanagari combining marks, CJK line breaking → rendered correctly, not isolated letters or cut-off diacritics
- [medium · agent] Web fonts loaded for the active locale only (no 20 MB CJK font download on English pages) → network log shows a sensible size
- [low · agent] Bold, italic and uppercase transformations → apply only where the script supports them (Arabic has no uppercase; Turkish dotted/dotless I)

### Dates, times, numbers and currency
- [high · agent] Dates in each region (`en-US` 11/16/2026, `en-GB` 16/11/2026, `de-DE` 16.11.2026, `ja-JP` 2026/11/16) → formatted with the user's locale, not a hard-coded pattern; an ambiguous 03/04 never appears where a mistake costs money
- [high · agent] Numbers: thousands and decimal separators (1,234.56 vs 1.234,56 vs 1 234,56) in display, input and export → parsed and shown correctly; typing "1,5" in a German locale means 1.5 {smoke}
- [high · agent] Currency: symbol, position, decimals (JPY has none, KWD has three), and the code when ambiguous ($ in several countries) → correct; the amount charged equals the amount shown
- [medium · agent] Number systems (Arabic-Indic digits, Devanagari) where the locale uses them → shown or accepted consistently; input in either digit set works or is rejected clearly
- [medium · agent] First day of week (Sunday, Monday, Saturday), 12 vs 24 hour clock, calendars (Hijri, Buddhist, Japanese era) where claimed → calendars and pickers follow the locale
- [medium · agent] Units (km/miles, °C/°F, kg/lb, paper size A4/Letter) → follow the locale or an explicit setting
- [medium · agent] Names and addresses: single-name users, family-name-first order, no postal code, long addresses, apartment formats → forms accept them; no "First and Last required" for cultures without that split
- [medium · agent] Phone numbers with country codes and different lengths → accepted in E.164-style input; formatted per locale
- [medium · agent] Percent, ranges and relative time ("3 days ago", "in 2 hours") → localised, with plurals

### Time zones and DST
- [high · agent] Set the browser/device to UTC, UTC+14 (Pacific/Kiritimati), UTC-12 and a DST zone; view the same stored event → shows the same moment correctly in each zone; stored values are UTC or carry an offset
- [high · agent] Create an event across a DST change (the missing hour in spring, the repeated hour in autumn) → no lost event, no duplicate, no one-hour shift; recurring events stay at the same local time
- [medium · agent] An event at 23:30 local that is the next day in UTC, and at midnight → right date in lists, filters, "today" and exports
- [medium · agent] Server-side jobs and emails ("daily at 9am") for users in different zones → fire in the user's zone; the zone is stored, not guessed from the server
- [medium · agent] Zones with 30- or 45-minute offsets (Asia/Kolkata, Asia/Kathmandu) → offset arithmetic stays correct
- [medium · agent] User changes zone or travels → past items keep their meaning; "all-day" events don't slip a day
- [low · agent] Leap day (29 Feb), 31st of month to a 30-day month, year 2038 and 1970 edges → handled

### Input of non-Latin text
- [high · agent] Enter Arabic, Hebrew, Chinese, Japanese, Korean, Hindi, Thai, emoji (including ZWJ sequences and flags) and accented letters in every text field, search and name → saved, shown and exported intact; length limits count characters people see, not bytes
- [medium · agent] Combining characters: "é" as one code point vs "e" + accent → treated as equal for search, duplicates and username checks (Unicode normalisation)
- [medium · device] IME composition (pinyin, kana, hangul) → the field accepts the composed text; Enter confirms the composition without submitting the form; no events fire half-way through composition
- [medium · agent] Paste and drag-drop of non-Latin text → same result as typing
- [medium · agent] Usernames, slugs and file names with non-ASCII text → either allowed and safe, or rejected with a clear message; URLs with encoded characters work
- [low · agent] Right-to-left override and zero-width characters in names → don't break layout or spoof other users {security}

### Locale switching and persistence
- [high · agent] Change the language in the app → UI updates without losing unsaved work; the choice persists after reload and relaunch {smoke}
- [medium · agent] Locale choice order: saved setting, then browser/OS language, then default → matches the product's claim; the URL (`/de/`) and the setting agree
- [medium · agent] Change the OS language while the app is closed, then open → the app follows OS language if it claims to
- [medium · agent] Region differs from language (English UI, German region) → formats follow the region as the product says
- [medium · agent] Language in shared links, emails and push already sent → open in the recipient's language or a stated default
- [medium · agent] Search engines and pages: `hreflang`, translated titles and meta descriptions, one canonical per language → present for each language page (web)

### Sorting, search and collation
- [medium · agent] Sort a list containing names such as Ångström, Zoë, Émile, ñandú, Ärger, "i", "İ", "ı" in several locales → order follows locale rules (Swedish Å after Z, German Ä with A); not raw code-point order
- [medium · agent] Case-insensitive search for Turkish "I" and German "ß" → finds the expected items per locale
- [medium · agent] Natural number sorting ("item 2" before "item 10") where claimed → right order
- [low · agent] Search for text without accents ("cafe" finds "café") where the product claims it → works both ways

### Export, files and external formats
- [medium · agent] Export CSV, JSON, PDF and email in each locale → the encoding is UTF-8 (CSV opens in Excel with correct characters; a BOM is added if needed); the delimiter doesn't collide with the locale's decimal comma
- [medium · agent] Import files in other encodings or with other date/number formats → rejected clearly or converted correctly
- [low · agent] File names with non-ASCII characters on upload and download → preserved or safely transformed

## Gates

- Accessibility interplay: `lang` attributes and text direction affect screen readers (see `accessibility.md`).
- If the product ships in the EU, check the consumer-facing legal texts exist in the languages sold in; legal review is the user's call.
- App stores: store listings and screenshots per locale are part of the Apple and Google gates.

## Human-only checks

- [human] A fluent reader walks the top 5 screens in each claimed language → wording is natural, not machine-translated nonsense, and the tone suits the product.
- [human] A native RTL reader walks the main flow in Arabic or Hebrew → reading order, mirroring and mixed numbers feel right.
- [human] On a real phone, type in the language's keyboard and IME → composition, suggestions and Enter behave.
- [human] Review marketing and legal text translations → meaning matches the original; no wording that could cause offence or legal problems.
- [human] Check images, colours and gestures for cultural problems in each target market.

## Known pitfalls

- **Pseudo-locale brackets and accents are intentional.** They aren't typos.
- **Don't flag untranslated brand names, product names or code terms** that are deliberately kept.
- **Machine translation quality isn't a bug unless the product claims human translation.** Record it as a question.
- **Browsers vary in date and number formatting for the same locale tag** (ICU version differences). Compare to CLDR, not to another browser.
- **A fake locale in Playwright doesn't change the OS keyboard or fonts.** Font and IME checks need a real setup.
- **Arabic digit shaping:** both Western digits and Arabic-Indic digits can be right in `ar`; the region (`ar-EG` vs `ar-MA`) decides. Check what the product claims.
- **Time zone tests need a stable clock.** Use a fixed test date, since DST dates move with the year.
- **`toLocaleString` output changes between Node versions.** Pin the version before comparing strings.

## Sources

1. [Microsoft Learn: How to perform internationalization testing](https://learn.microsoft.com/en-us/globalization/testing/how-to-perform-internationalization-testing) — pseudo-localisation, sorting, IME, tofu (checked 2026-11-16)
2. [Android: Pseudolocales](https://developer.android.com/guide/topics/resources/pseudolocales) — en-XA and ar-XB (checked 2026-11-16)
3. [Unicode CLDR: plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules) — plural categories per language (checked 2026-11-16)
4. [W3C: Structural markup and right-to-left text](https://www.w3.org/International/questions/qa-html-dir) — `dir`, bidi isolation (checked 2026-11-16)
5. [Playwright: Emulation](https://playwright.dev/docs/emulation) — locale and timezone emulation (checked 2026-11-16)
6. [Apple: Testing your app's localization](https://developer.apple.com/documentation/xcode/localization) — pseudolanguages in Xcode (checked 2026-11-16)
