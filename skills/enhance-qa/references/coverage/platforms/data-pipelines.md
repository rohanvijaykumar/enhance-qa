---
module: data-pipelines
kind: platform
title: Data pipelines, dashboards and reports
checked: 2026-11-16
---
# Data pipelines, dashboards and reports

Covers ETL and ELT jobs, streaming and batch pipelines, warehouses and lakes, analytics models (dbt and similar), dashboards (Metabase, Superset, Looker, Power BI, Tableau, Grafana, custom) and scheduled reports. The question is "are the numbers right, complete, on time and only visible to the right people?". It goes with `apis-backend.md` for ingestion APIs, `../features/data-import-export.md`, `../features/security.md`, `../features/privacy-consent.md` and `../features/performance.md`. Test on copies or a staging warehouse; production data is read-only.

## Signals

- `dbt_project.yml`, `models/`, `schema.yml`; Airflow `dags/`, Dagster, Prefect, Luigi, Kestra; Spark or Flink jobs; SQL files with `INSERT`, `MERGE`; Great Expectations or Soda config; Kafka consumers, CDC tools (Debezium, Fivetran, Airbyte).
- Dashboard definitions (Metabase, Superset, Grafana JSON, LookML, `.pbix`, `.twb`), scheduled report jobs, export CSV or PDF code.
- README words: "pipeline", "ETL", "warehouse", "dashboard", "KPI", "report", "backfill".

## Kickoff questions

1. Where do test runs happen: a staging or dev warehouse, a local database, or only production? (best guess: a local or dev copy with a small sample; if only production exists, read-only queries and no job runs)
2. What are the sources, targets and the ten numbers that matter most to the business? (best guess: read the models and dashboards; list the key metrics and their definitions)
3. How often does it run, and what freshness and correctness is promised? (best guess: read the schedule and any SLA text)

## Drivers

1. **The project's own data tests.** `dbt test` (generic tests: `unique`, `not_null`, `accepted_values`, `relationships`; singular SQL tests; unit tests on models), `dbt build`, Great Expectations checkpoints, Soda scans, SQL assertions; Airflow DAG import tests (`airflow dags list-import-errors`, `DagBag`) and task unit tests. Run first and record as the baseline [1][2].
2. **SQL against source and target.** The cheapest deterministic oracle: a read-only client (`psql`, `sqlite3`, `duckdb`, `bq`, `snowsql`, the warehouse's CLI) running reconciliation queries (counts, sums, min and max, distinct counts, checksums by partition). Keep queries in files and store the results as evidence.
3. **Small fixture datasets and a local engine.** Run the pipeline on a hand-made input (10 to 1,000 rows) with known edge cases, using DuckDB, SQLite, a Docker Postgres or the framework's test mode (`dbt build --target dev`, Airflow `dags test`). Compare the output with a hand-calculated expected file (golden file diff, `diff`, `datacompy`, `pandas.testing.assert_frame_equal`).
4. **Data diff tools.** `data-diff` or `datacompy` to compare two tables (before and after a change, source and target); dbt `audit_helper` for model comparisons.
5. **Pipeline orchestration control.** Trigger and re-run single tasks or dates in a test environment (`airflow dags test`, `dagster job execute`, `prefect deployment run`), inspect logs and state tables. Never trigger production runs or backfills.
6. **Dashboards.** Query the dashboard's underlying SQL through the BI tool's API or by exporting the query; compare with the hand-checked query. For the UI use Playwright (scoped accessibility snapshot, then read table values and chart tooltips; screenshots only for layout). Many BI tools also expose APIs to read charts and permissions.
7. **Profiling.** `pandas-profiling` (ydata-profiling), `duckdb` summarise, `great_expectations` profilers to see distributions, nulls and outliers fast.
8. **Static checks.** `sqlfluff` for SQL style and errors, `dbt parse`, `dbt docs generate` for lineage, dependency scans.

**Can't be driven here:** production loads and real customer data (never touched), the correctness of business definitions (what counts as an "active user") which a business owner decides, real source systems with credentials the agent shouldn't hold, true scale and cost (human with the warehouse bill), and legal decisions about PII. Dashboards that need a licensed BI desktop client (Power BI Desktop, Tableau Desktop) are human or device checks on Windows or macOS.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | the main pipeline on a small fixture, then the key dashboard number against a hand query |
| check | smoke cell, plus changed models and their downstream, plus re-run for idempotency |
| full | pairwise over source × data shape (clean, nulls, duplicates, late, schema change) × run mode (full, incremental, backfill) × time zone |
| release | all pipelines on a recent staging copy, every key metric reconciled, permissions and PII review, failure and recovery drills, human sign-off on definitions |

Dimensions: source and target systems; data shape (typical, empty, one row, huge, nulls, duplicates, malformed); arrival (on time, late, out of order, replayed); run mode (full refresh, incremental, backfill, retry); schema state (current, a new column, a removed column, a type change); time zone and daylight saving; user role; volume; engine versions.

## Check catalogue

### Reconciliation and correctness
- [high · auto] Row counts, sums of key numeric columns, min and max dates and distinct key counts: source versus target for the same window → equal, or each difference is explained by a documented filter or rule {smoke}
- [high · auto] Run the pipeline on a hand-built fixture with known answers, including a few rows per edge case → output matches the hand-calculated expected file exactly {smoke}
- [high · auto] Check primary-key uniqueness and not-null on every key column of every final table (`unique`, `not_null`) → no duplicates or nulls in keys
- [high · auto] Check referential integrity (`relationships` tests, foreign keys without orphans) between facts and dimensions → no orphan rows, or orphans are routed to an "unknown" member by design
- [high · auto] Recompute the top business metrics from raw data with an independent query and compare with the published model or dashboard value → same number within rounding; the definition is written next to it {smoke}
- [medium · auto] Check measure arithmetic: totals equal the sum of parts; percentages sum to 100 where they should; averages weighted properly; no double counting after joins (a many-to-many join multiplying rows) → consistent at every level of aggregation
- [medium · auto] Check data types, precision and rounding (money as decimal not float; integer overflow; timestamps with time zone; trimmed strings) → no precision loss; rounding rule documented and applied once
- [medium · auto] Check accepted values and ranges (status enums, negative amounts, dates in the future, impossible ages) → violations counted and routed or rejected, not silently kept
- [medium · auto] Check data type and format drift between source versions, files and locales (decimal comma, date formats, encodings, BOM, line endings) → parsed correctly; bad rows quarantined with a reason
- [medium · agent] Spot-check 20 random rows from source to final by hand, following each transformation → every field is correct; the lineage matches the docs
- [medium · auto] Check filters and joins: inner versus left join row loss, soft-deleted rows, test and internal accounts, currency conversions → the excluded rows are what the definition says

### Nulls, duplicates and bad data
- [high · auto] Feed rows with nulls in every nullable column, empty strings, "N/A", "null" text, zero and whitespace → treated consistently; aggregations (sum, avg, count distinct) behave as the definition says
- [high · auto] Feed exact duplicates, near duplicates (case, whitespace), and the same key with different values → deduplicated by the documented rule (latest wins, first wins); counts are right
- [medium · auto] Feed malformed records: bad JSON, wrong column count, invalid UTF-8, huge fields, injection strings in text, extreme numbers → quarantined or rejected with an error count and reason; the job doesn't fail wholesale unless designed to
- [medium · auto] Feed an empty file, a header-only file, an empty partition and a source with zero rows → the job succeeds with zero rows or alerts as designed; downstream tables aren't wiped by accident
- [medium · auto] Feed one row, one million rows (staging) and a very wide table → completes within the time and memory limit; the same logic at every size
- [medium · agent] Check the dead-letter or quarantine table → bad records are kept with the error and a way to reprocess; they are visible to owners, and not lost

### Late, out-of-order and time
- [high · auto] Late-arriving data: insert yesterday's event today, after the daily aggregate ran → the aggregate is corrected by the next run or the late window rule; the dashboard value changes accordingly
- [high · auto] Out-of-order and duplicate events (stream or batch): replay events in reverse and twice → the final state equals the in-order result; no double counting
- [high · auto] Time zones: events near midnight in UTC and local time, a user in a different zone, daylight-saving transitions (23 and 25 hour days), and week and month boundaries → grouped into the right day; timestamps stored in UTC and converted for display; documented week start
- [medium · auto] Watermarks and freshness: stop the source for hours, then resume → freshness alert fires; after catch-up, no gaps and no duplicates; the "last updated" shown on the dashboard is true
- [medium · auto] Leap days, month-end, fiscal calendar and year-end dates in date logic → correct period assignment
- [medium · agent] Clock skew between systems and time on the pipeline host → job windows don't skip or repeat data

### Schema changes and evolution
- [high · auto] Add a column, remove a column, rename a column, change a type and reorder columns in the source (on a copy) → the pipeline fails loudly with a clear message or adapts as designed; it never silently drops, shifts or misaligns data
- [medium · auto] Add a new enum value or a new category in the source → handled (an "other" bucket, or an alert); not dropped; dashboards show it
- [medium · auto] Run a model change through `dbt build` with `--select state:modified+` or equivalent and diff before and after → only intended outputs changed; downstream models and dashboards still work
- [medium · auto] Check contracts and tests on public models (`contract: enforced`, column types) → violations block the build
- [medium · agent] Change a dashboard's source query column name → the dashboard shows an error or the change is caught in review; it isn't blank or wrong without notice

### Idempotency, reruns and backfills
- [high · auto] Run the same job twice for the same window → the output is identical; no duplicate rows; counts unchanged {smoke}
- [high · auto] Kill the job halfway and re-run → the final output equals one clean run; no partial data visible to readers (atomic swap, transaction or staging then publish)
- [high · auto] Backfill a past date range on a staging copy, including a range that spans a schema change → correct values for each period; the backfill doesn't overwrite newer corrected data without intent; runtime is acceptable
- [medium · auto] Incremental versus full-refresh: run both and compare → identical results; incremental keys and merge logic handle updates and deletes
- [medium · auto] Concurrent runs of the same and different jobs → locks or run IDs prevent clashes; no deadlocks or double writes
- [medium · auto] Retries and failure handling: simulate a source outage, a timeout and a full disk → retries with backoff; the failure is alerted with run ID and cause; the state is recoverable
- [medium · agent] Check handling of deletes and updates in the source (CDC tombstones, soft deletes, late corrections) → target reflects them as designed; history tables keep the right versions (slowly changing dimensions)

### Dashboards and reports
- [high · agent] For each key dashboard tile, find the tile's SQL, run an independent hand-checked query and compare → numbers match; filters, date range and time zone are the same; the definition on the tile matches the query {smoke}
- [high · agent] Apply each filter and combination, and clear filters; change the date range, granularity and comparison period → numbers change correctly; totals stay consistent with the detail; no stale cache
- [medium · agent] Check empty states (no data in the period), single-row and huge-cardinality groupings (10,000 categories), nulls and "unknown" buckets → readable; truncated lists say so; no blank or misleading chart
- [medium · agent] Check charts: axis starts, units, currency and number formats, legends, colours and labels, rounding in labels versus tooltips, and the sort order → accurate and not misleading; colour not the only cue {a11y}
- [medium · agent] Check the dashboard's load time with realistic data and concurrent viewers (a handful) → within the stated or reasonable time; heavy queries are cached or pre-aggregated
- [medium · agent] Check exports (CSV, Excel, PDF, scheduled email): totals, formatting, encoding, locale, large exports and truncation notices → export equals the screen; no formula injection from cells starting with `=`, `+`, `-` or `@` {security}
- [medium · agent] Check scheduled reports in a test mailbox only: time, time zone, recipients, content, unsubscribe and failure behaviour → arrives once, correct, to test recipients only; never to real recipients
- [low · agent] Check mobile and small-screen layouts and print views → usable

### Permissions, PII and governance
- [high · agent] Log in as roles with different rights (admin, analyst, viewer, external, no access) and open the same dashboards, tables and exports → each sees only their allowed rows and columns; row-level and column-level security work; direct links don't bypass it {security}
- [high · auto] Scan target tables, logs, exports and dashboards for PII (emails, phone numbers, names, IDs, free-text fields that hold personal data) → PII only where allowed; masked, hashed or dropped elsewhere; tests use fake data {security}
- [high · agent] Check service accounts and credentials in pipeline code and configs → no secrets in the repo, logs or dashboards; least-privilege roles; the pipeline can't read or write outside its schemas {security}
- [medium · agent] Deletion and retention: delete a (fake) user's data at the source, run the pipeline → the data is gone from derived tables, backups per policy, caches and exports within the stated time {security}
- [medium · agent] Check lineage and ownership: each table and metric has an owner, a description and a documented definition → present; docs match the logic
- [medium · agent] Check audit logs of who queried or exported sensitive data → recorded
- [medium · auto] Check cost and resource guardrails: query limits, partition pruning, a runaway query on a test warehouse → capped; no full scan of a huge table by a dashboard filter

### Observability
- [medium · agent] Force each failure (bad source, failed task, late data, test failure) and check alerts → alert arrives at the right channel in test, once, with run ID and cause; no alert storms; no silent failures
- [medium · auto] Check run history and metadata tables (rows in, rows out, duration, status) → complete and consistent with the data
- [medium · agent] Check anomaly checks (volume, freshness, distribution) → fire on injected anomalies; low false positives on a normal week

## Gates

There is no store gate. Reconcile before release and sign off the definitions:

- Key metrics match independent hand-checked queries.
- Source-to-target counts and sums reconcile on staging.
- Re-runs and backfills are idempotent; a killed run leaves no partial data visible.
- Role-based access, PII masking and deletion work.
- Schema-change and late-data behaviour are tested and documented.
- No pipeline or test touched production writes.

Privacy rules for personal data: `../gates/privacy-law.md`.

## Human-only checks

- [human] Sit with the business owner and check the ten key numbers against what they expect from their own records → they agree on each number and its definition.
- [human] Review the metric definitions ("active user", "revenue", "churn") and the dashboard labels → written, agreed and the same everywhere.
- [human] Use the dashboards as a normal user for a real task → can you find the answer fast and trust it? Is anything confusing or misleading?
- [human] Review access rules and PII handling with whoever owns data protection → right people see the right data.
- [human] Watch the first production run and the first scheduled report to the real recipients (you run it) → correct and expected. (Agents never trigger production runs.)

## Known pitfalls

- **Timing differences aren't always bugs.** Source and target counts differ if the source keeps changing during the test. Freeze a snapshot or compare as-of the same timestamp.
- **Different but valid definitions.** Two systems may count "orders" differently; compare against the written definition, not the other system.
- **Floating-point noise.** Tiny differences (1e-9) in sums are float rounding; compare with a tolerance for floats, exact for decimals and counts.
- **Cached dashboards** show old numbers. Clear the cache or note the refresh time before reporting a mismatch.
- **Sampling and approximate functions** (`approx_count_distinct`, sampled tables) differ by design; check the documented error.
- **Test and internal accounts** in production data can explain differences; check the filter before filing.
- **dbt tests failing on pre-existing data** are the baseline, not caused by the current change. Record the baseline first.
- **A passing test suite isn't proof.** Tests may not cover the metric that matters. Reconcile the key numbers independently.
- **Time zones in the BI tool.** A dashboard's time zone setting changes day boundaries; confirm it before reporting a one-day shift.
- **Never run a backfill, delete or full refresh on production** to "see what happens".

## Sources

1. [dbt: data tests](https://docs.getdbt.com/docs/build/data-tests) — `unique`, `not_null`, `accepted_values`, `relationships`, singular tests (checked 2026-11-16)
2. [Great Expectations documentation](https://docs.greatexpectations.io/) — expectations and checkpoints for data quality (checked 2026-11-16)
3. [Apache Airflow: testing DAGs](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html) — DAG loading and task testing (checked 2026-11-16)
4. [OWASP: CSV injection](https://owasp.org/www-community/attacks/CSV_Injection) — formula injection in exported spreadsheets (checked 2026-11-16)
5. [DuckDB documentation](https://duckdb.org/docs/) — a local engine for fixtures, profiling and reconciliation queries (checked 2026-11-16)
