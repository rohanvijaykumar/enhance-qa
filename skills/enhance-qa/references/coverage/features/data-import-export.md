---
module: data-import-export
kind: feature
title: Data import, export and migrations
checked: 2026-11-16
---
# Data import, export and migrations

Bringing data in (CSV, Excel, JSON, XML, API sync) and getting it out (exports, backups, reports), and moving data between schema versions (database migrations, data migrations). File handling in general is in `file-upload-download.md`; admin export permissions are in `admin-backoffice.md`; pipeline correctness is in `../platforms/data-pipelines.md`. Usually goes with `i18n-rtl.md` and `security.md`.

## Signals

- "Import" or "Export" buttons, "Upload CSV", "Download report", templates to download.
- Dependencies: `papaparse`, `csv-parse`, `xlsx`, `exceljs`, `openpyxl`, `pandas`, `fast-csv`, `JSON.parse` on uploads.
- Migration tools: `prisma migrate`, `drizzle-kit`, `knex`, `typeorm`, `Alembic`, Django migrations, Rails migrations, Flyway, Liquibase, `sqitch`, Supabase migrations.
- Folders `migrations/`, `db/migrate/`, `seeds/`.

## Kickoff questions

1. Which formats are imported and exported, and is there a documented template or schema? (best guess: CSV in and out, with a downloadable template)
2. How big can an import be in real use? (best guess: 10,000 rows; test with 100,000)
3. Do migrations have a down path, and is there a copy of realistic data to test on? (best guess: up only; use a seeded or anonymized copy, never production)

## Drivers

1. **Generated fixture files.** Best default. A script writes test files: clean, with BOM, Latin-1, semicolon-delimited, quoted newlines, empty rows, duplicate keys, huge, malformed. Import by API or Playwright; check the database.
2. **Parsers and validators.** `csvkit` (`csvclean`, `csvstat`), Python `csv`, `jq`, `xmllint`, JSON Schema validators, `file` and `iconv` for encoding; open exports with a different parser than the app's own.
3. **Database comparison (read-only).** Row counts, checksums and sampled-field diffs between source file and tables; between before and after a migration.
4. **Migration tool dry-run, plus a scratch database.** Run migrations up, down and up again on a throwaway copy (Docker Postgres or SQLite file) seeded with real-shaped, anonymized data.
5. **Playwright** for the import wizard UI: mapping step, preview, progress, error report download.
6. **Spreadsheet engines headless** (LibreOffice `soffice --headless --convert-to`) to open exports as Excel would, including formula behavior.

**Can't be driven here:** opening exports in desktop Excel with real locale settings (Windows list-separator, Mac Numbers), and migrations against real production-sized data. These are human or release-environment checks, run on staging copies.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | import a clean file, see the rows, export, compare counts |
| check | smoke, plus one bad row file and the changed format |
| full | format x encoding x delimiter x size x clean or dirty |
| release | all of full, round trip, formula injection sweep, migration up/down on a copy, human Excel check |

Dimensions: format (CSV, XLSX, JSON, XML), encoding (UTF-8, UTF-8 with BOM, UTF-16, Latin-1, Windows-1252), delimiter (comma, semicolon, tab), locale (decimal comma), size (1, 1,000, 100,000+ rows), row quality, migration direction.

## Check catalogue

### Import: formats and parsing
- [high · agent] Import the provided template filled with valid rows → all rows appear with right values; a success summary gives counts that match {smoke}
- [high · auto] CSV with UTF-8 BOM, UTF-8 without BOM, Latin-1 and Windows-1252 text with accents (`é`, `ñ`, `ü`) → text shows correctly (no `Ã©` mojibake); the BOM doesn't end up in the first column name
- [medium · auto] Delimiters: comma, semicolon (common in European Excel), tab, pipe → detected, or the user is asked; a clear error if not supported
- [medium · auto] Quoted fields with commas, quotes (`""`), and newlines inside → one row each, values intact
- [medium · auto] Line endings (CRLF, LF, old Mac CR), trailing newline, blank lines, header only, empty file → handled; empty file gives a message, not a crash
- [medium · auto] Locale numbers and dates: `1.234,56`, `1,234.56`, `31/12/2026` vs `12/31/2026`, `2026-12-31`, text dates, Excel serial dates → parsed per documented rules; ambiguous dates are not silently swapped
- [medium · auto] Leading zeros (`007`, ZIP `02134`), long numbers (phone, IDs over 15 digits), scientific notation (`1E5`) → stored as text where needed; no lost digits
- [medium · auto] Excel files: multiple sheets, hidden sheets, merged cells, formulas, empty rows, dates, `.xls` vs `.xlsx`, password-protected → documented sheet is read; formulas give values; unsupported cases give a clear error
- [medium · auto] JSON: nested objects, arrays, nulls vs missing, very large numbers, duplicate keys, invalid JSON, wrong schema → validated against the schema; errors say where
- [medium · auto] Header handling: reordered columns, extra columns, missing columns, case and space differences, duplicate headers → mapping works or a clear mapping screen; no silently shifted columns {smoke}
- [medium · agent] Mapping UI: auto-match, manual map, save mapping, skip column → preview matches what will be imported

### Import: partial failure and reports
- [high · agent] File of 100 rows with 5 bad rows (missing required, bad format, duplicate key, too long) → behavior as documented: import good rows or none (all-or-nothing); never half-state that isn't explained {smoke}
- [high · agent] Error report → lists row number, column, value and reason for each bad row; downloadable; can fix and re-import only the failed rows
- [medium · agent] Re-import the same file → duplicates handled by documented rule (skip, update, or error); no silent doubles
- [medium · agent] Update-by-key imports: changed, unchanged, new, and removed rows → each handled as documented; unchanged rows aren't touched
- [medium · agent] Preview or dry-run step (if offered) → shows the same counts as the real import
- [medium · agent] Cancel mid-import, close tab, lose connection → job stops cleanly or continues in the background; the status survives reload
- [medium · agent] Imported data validated like data typed in forms → same rules as `forms-validation.md`; no bypass of limits, uniqueness or permissions {security}
- [medium · agent] Import as a plain user into another user's workspace or by ID → refused {security}

### Import: scale and safety
- [medium · auto] 100,000 rows → completes, or runs as a background job with progress; memory and time stay reasonable; UI stays responsive
- [medium · auto] A file over the size limit, or with 1,000+ columns → rejected with a message before processing
- [high · auto] Cells starting with `=`, `+`, `-`, `@`, and values holding HTML or script, or XML entities (XXE, billion laughs) → stored as plain text and escaped when shown; XML parser doesn't resolve external entities {security}
- [medium · auto] Zip or XLSX bombs, very deep JSON nesting → rejected without exhausting resources {security}
- [medium · agent] Imports that trigger side effects (emails, webhooks, notifications) → go to the catcher in test; bulk import doesn't send thousands of emails unless intended

### Export
- [high · agent] Export a list → file opens in the standard viewer; row count, columns and values match the screen and database; filters and sort are honored as the label says {smoke}
- [high · auto] Export values starting with `=`, `+`, `-`, `@` (tab or CR at start too) → neutralized, usually by a leading apostrophe or single quote, so a spreadsheet doesn't run them as formulas; test by opening in LibreOffice headless {security}
- [medium · auto] Export encoding → UTF-8 with BOM if documented for Excel, or UTF-8 plus a note; accents and CJK display right in Excel
- [medium · auto] Delimiter and number format → match the stated locale; decimal comma doesn't break columns; dates are ISO or documented
- [medium · auto] Special values: commas, quotes, newlines, leading zeros, long numbers, emoji, null and empty → quoted and escaped; leading zeros kept; no `E+15`
- [medium · auto] Empty export (no rows) → file with the header only, or a clear message
- [medium · agent] Large export (100,000+ rows) → streams or runs as an async job; no timeout; the download link is private and expires {security}
- [medium · agent] Export permissions → only data the user may see; hidden columns (internal IDs, secrets, other users' data) never included {security}
- [medium · agent] File name → includes a sensible name and date; no illegal characters; extension matches the content
- [low · agent] Export formats offered (CSV, XLSX, JSON, PDF) → same data in each

### Round trip
- [high · auto] Export, then import the exported file into a clean copy → data equal: counts, values, relations, order where it matters; nothing dropped or changed (dates, time zones, leading zeros, unicode, empty vs null) {smoke}
- [medium · auto] Edit the exported file in a spreadsheet, save, re-import → still imports; Excel's own changes (date format, number format) are handled or reported
- [medium · auto] Export from one locale and import in another → values still equal
- [medium · auto] Relations and IDs (parent-child, foreign keys, tags) → preserved or remapped consistently

### Migrations: schema and data
- [high · auto] Apply all migrations to an empty database → succeeds; schema matches the ORM or schema file (migration tools' drift check, like `prisma migrate diff` or `alembic check`) {smoke}
- [high · auto] Apply new migrations on a copy of real-shaped data (anonymized, seeded to realistic size and ugliness: nulls, duplicates, very long values, legacy states) → succeeds; row counts and checksums of preserved data match; no data loss
- [high · auto] Roll back (down) on the copy, then up again → schema returns to the earlier state and the data survives, or the migration is clearly marked irreversible
- [medium · auto] Migration time and locks on a table of production-like size → within the maintenance window; no long exclusive lock on hot tables; large backfills are batched
- [medium · auto] Run the same migration twice, or re-run after an interruption → idempotent or safely refused; no half-applied state
- [medium · auto] New NOT NULL columns, renamed columns, type changes, dropped columns → defaults and backfills right; app code of the old version still works during a rolling deploy (expand then contract)
- [medium · auto] Data migrations (transforming existing values) → sample before and after; edge values (null, empty, huge, unicode) handled; counts reconcile
- [medium · auto] Seed and fixture scripts → run on a clean database without errors; contain no real personal data
- [high · human] Back up before migrating, restore the backup into a scratch environment → data and schema come back as they were

## Gates

- Import: bad rows are reported by row and reason, with no silent loss or shifted columns.
- Export: formula injection neutralized; permissions respected.
- Round trip is lossless.
- Migrations succeed up (and down where promised) on a copy of real-shaped data; a tested backup exists before any production migration.

## Human-only checks

- [human] Open each export in desktop Excel (and Numbers or Google Sheets if users use them) with your own regional settings → columns split correctly, accents right, no formula warnings, no 1E+15 numbers
- [human] Import a messy file from a real customer (anonymized by the owner) on staging → the mapping and error report make sense to a non-technical user
- [human] Run production migrations only after a rehearsal on a fresh copy and a verified backup; the owner presses go
- [human] Check imported and exported personal data handling with the privacy owner → retention, consent and deletion match policy

## Known pitfalls

- **Excel opening a CSV as ANSI.** Accents garbled in Excel but fine in other tools often means missing BOM; compare with the documented behavior before filing.
- **Excel mangles data on open** (dates, leading zeros, long numbers); that's Excel's guessing, not the export, unless the product claims Excel-safe output.
- **Formula injection prefixes** (a leading apostrophe) are intended and may show in raw CSV.
- **Locale-dependent separators.** Semicolon CSVs from European Excel are normal.
- **Timestamps in exports** may be UTC while the UI shows local time; check the docs before reporting a mismatch.
- **Dry-run migrations on an empty database prove little.** Don't mark migrations safe from that alone.
- **Never run migrations or imports against production**; production is read-only, and never put real customer data into test fixtures.

## Sources

1. [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) — formula injection and mitigation (checked 2026-11-16)
2. [RFC 4180: CSV format](https://www.rfc-editor.org/rfc/rfc4180) — quoting, line breaks (checked 2026-11-16)
3. [OWASP XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html) — XML import safety (checked 2026-11-16)
4. [csvkit documentation](https://csvkit.readthedocs.io/) — CSV inspection tools (checked 2026-11-16)
5. [Prisma: migrate troubleshooting and drift](https://www.prisma.io/docs/orm/prisma-migrate) and [Alembic](https://alembic.sqlalchemy.org/) — migration up, down and drift tooling (checked 2026-11-16)
6. [Supabase: going into production](https://supabase.com/docs/guides/deployment/going-into-prod) — backups before change (checked 2026-11-16)
7. Research notes: `11-vibe-coders.md` (AI agents running destructive migrations; data loss without backups)
