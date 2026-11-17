---
module: search-filter-sort
kind: feature
title: Search, filter and sort
checked: 2026-11-16
---
# Search, filter and sort

Search boxes, full-text and fuzzy search, faceted filters, sort controls, pagination and infinite scroll, in apps, sites and APIs. Focus: right results, odd input, combined state, shareable URLs and speed on large sets. Usually goes with `web-app.md`, `i18n-rtl.md`, `performance.md` and `admin-backoffice.md`.

## Signals

- Search input, `?q=`, `?sort=`, `?page=`, facets, chips, "Filters" panels.
- Dependencies: Algolia, Elasticsearch, OpenSearch, Meilisearch, Typesense, Lunr, Fuse.js, Postgres full-text (`tsvector`, `pg_trgm`), SQL `LIKE`, `django-filter`, Ransack.
- API parameters: `filter[...]`, `orderBy`, `limit`, `cursor`, `offset`.

## Kickoff questions

1. What is searched, and how many records exist in real use? (best guess: one main collection; test with 10, 1,000 and 50,000 seeded records)
2. Which engine, and is typo tolerance or synonyms promised? (best guess: SQL or simple text match, no fuzzy matching)
3. Is any data private per user, so results must be scoped? (best guess: yes, per account)

## Drivers

1. **HTTP client against the search API.** Best for exact results, special characters, paging, sorting and timing. Table-driven: query in, expected IDs out, from a seeded dataset with known contents.
2. **Seed script with a designed dataset.** Create records with known words, accents, ties and duplicates (for example "Café", "cafe", "CAFE", two items with the same date), so expected results are knowable.
3. **Playwright.** For UI state: typing, debounce, chips, scroll loading, URL changes, Back button. Use scoped snapshots of the results list and read counts rather than screenshots.
4. **Engine's own tools.** Elasticsearch `_analyze` and `_explain`, Algolia dashboard, Meilisearch and Typesense search preview; Postgres `EXPLAIN ANALYZE` for slow queries.
5. **Lighthouse or the browser performance panel** for scroll and interaction cost on large lists.

**Can't be driven here:** relevance quality judged by a person ("is this the best first result?"), voice search, and real-world query logs from production. These become human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | one known query returns the known record; one filter and one sort change the list |
| check | smoke, plus empty result, special characters, and pagination |
| full | pairwise over query type x filters x sort x dataset size x signed-in scope |
| release | all of full, 50,000-record dataset, human relevance review, URL-sharing sweep |

Dimensions: query kind (word, phrase, prefix, number, empty, special), dataset size (0, 1, 1,000, 50,000+), filters active (none, one, many), sort key and direction, page position, locale.

## Check catalogue

### Basic and relevance
- [high · agent] Search for a word that exists in exactly one seeded record → that record appears, and only matching records appear {smoke}
- [medium · agent] Multi-word query, quoted phrase, word order swapped → results are sensible; the best match is near the top; behavior matches what the UI promises (all words vs any word)
- [medium · agent] Prefix and partial words ("ban" for "banana") → matches if search-as-you-type is promised; otherwise a clear rule
- [medium · agent] Search across the fields the UI claims (title, body, tags, author) → each field's term finds its record; fields not meant to be searchable (private notes, internal IDs) don't
- [medium · human] Review the top 5 results for 10 realistic queries → the best answer is near the top; obvious wrong results do not outrank right ones
- [medium · agent] Results highlight the matched terms correctly (no broken HTML, no highlight of other words)
- [low · agent] Singular/plural, stop words ("the"), stemming, synonyms (only if promised) → behave as documented

### Empty, no results and reset
- [high · agent] Query with no match → a useful no-results message that repeats the query, suggests a next step, and offers "clear search"; not a blank or an error
- [medium · agent] Empty query, spaces only → shows everything, or asks for input; never an error or all records without paging
- [medium · agent] Clear the box or the filters → the full list returns, counts and pages reset to the first
- [medium · agent] Slow or failing search backend (throttle or stop the engine in the test environment) → a readable error with retry; old results aren't mislabeled as new

### Special characters and injection
- [high · auto] Queries with quotes, backslash, `%`, `_`, `*`, `?`, `&`, `#`, `<script>`, `' OR 1=1 --`, `)(`, unmatched brackets → no 500, no unescaped HTML shown, no SQL or query-syntax error, wildcard characters act as plain text unless promised {security}
- [medium · auto] Very long queries (1,000+ characters) and many words → rejected or trimmed with a message; no crash or slow query
- [medium · agent] Emoji, CJK, RTL text and combining characters → no errors; matches work for the stored language (see `i18n-rtl.md`)
- [medium · auto] Search-query syntax from the engine (`field:value`, `-term`, `AND`, `OR`) typed by a user → behaves as documented, or is treated as plain text; no field-level access to private fields {security}

### Case, accents and typos
- [high · auto] Same word in lower, UPPER and Title case → same results
- [medium · auto] "cafe" vs "café", "naive" vs "naïve", German "ß" vs "ss", Turkish dotted/dotless I → documented behavior; accent-insensitive matching if promised
- [medium · agent] Typos: one-letter swaps and drops ("recieve") → fuzzy match finds it if promised; otherwise "did you mean" or a clear no-results
- [low · agent] Numbers and units ("10 kg", "10kg", "1,000" vs "1000"), dates in several formats → documented behavior

### Filters
- [high · agent] Apply one filter → list and the count both update; every shown row satisfies the filter {smoke}
- [high · agent] Combine filters (AND across facets, OR within a facet, as designed) and a text query → results satisfy all conditions; counts next to facet values stay right
- [medium · agent] Filter that yields zero results → empty state names the active filters and offers a one-click reset; facets with zero count are disabled or hidden consistently
- [medium · agent] Range filters (price, date): min greater than max, empty min, negative, boundaries inclusive or exclusive → handled with a message; boundary values behave as labeled
- [medium · agent] Remove one filter chip among several → only that filter is removed
- [medium · agent] Filters on data the user can't see (other users' records, drafts, deleted items) → never leaks; counts don't reveal hidden items {security}
- [medium · agent] Dates and time zones in filters ("today", "last 7 days") → boundaries follow the user's time zone as documented

### Sorting
- [high · agent] Sort by each offered key, ascending and descending → order is correct for text (locale-aware, case-insensitive if promised), numbers (10 after 9, not after 1) and dates {smoke}
- [high · auto] Ties (equal values) and nulls → order is stable and deterministic across reloads and pages; the same item never appears on two pages or is skipped, because of a missing tiebreaker {smoke}
- [medium · agent] Sort plus filter plus search together → all three apply; changing one keeps the others
- [medium · agent] Default sort → stated and sensible (newest first, relevance when searching); the control shows the current sort
- [low · agent] Sort by a field that has blanks or mixed types → blanks go last (or first) consistently

### Pagination and infinite scroll
- [high · agent] Go through every page of a seeded set of known size → each record exactly once; the total count and the number of pages match; last page is partial and right {smoke}
- [high · agent] Page 0, negative, beyond the last page, non-numeric in the URL or API → a clear last-page or error response, never a crash or a full dump
- [medium · agent] Page size parameter: 0, 1, max, huge → capped by the server; a very large `limit` doesn't return everything {security}
- [medium · agent] Records added or deleted while the user pages → no duplicates or gaps if cursor-based; documented drift if offset-based
- [medium · agent] Infinite scroll: scroll to the end → loading indicator, then an "end of list" state; no endless re-request loop; keyboard users can reach items after the list and the footer {a11y}
- [medium · agent] Infinite scroll: press Back from an item, or reload → position and loaded items are restored, or the page says where you are
- [medium · agent] "Load more" and numbered pages show the same count and order for the same query

### URL and state
- [high · agent] Search, filter, sort and page → URL reflects all of it (query string); copy the URL into a new tab → identical results and controls {smoke}
- [medium · agent] Back and Forward → move through search states without breaking; one history entry per committed search, not one per keystroke
- [medium · agent] Reload and bookmark → same state; private-scope results still require sign-in
- [medium · agent] Hand-edited URL with unknown or invalid parameters (`sort=banana`, `page=abc`) → ignored or a clear message; no 500

### Performance and scale
- [high · auto] Query against a 50,000-record seeded set → the first page returns within the target or about 1 second locally; query plan uses an index (no full table scan on common queries)
- [medium · agent] Type fast in the search box → debounced requests; stale responses never overwrite newer ones (the last query typed is the one shown)
- [medium · agent] Large result list rendering → scrolling stays smooth; the DOM isn't thousands of nodes without virtualization
- [medium · auto] Count queries and facet counts on big sets → don't time out; counts are shown as approximate where exact is costly
- [low · agent] Repeated identical queries → served quickly (cache), and cache is cleared when data changes

### Accessibility
- [medium · agent] Search and filter controls → labeled, keyboard-operable, with a live region announcing the result count after changes {a11y}
- [medium · agent] Autocomplete lists → arrow keys, Enter and Esc work; roles are `combobox` and `listbox` {a11y}

## Gates

- Seeded known-answer queries return the exact expected records.
- No 500 on special characters.
- Pagination returns each record once; sort is deterministic.
- URL carries the state.
- No private data in results, counts or suggestions.

## Human-only checks

- [human] Run 10 real-world queries from your own users → are the top results what they would want?
- [human] Use search on a phone with the on-screen keyboard → controls reachable, results readable, scroll feels smooth
- [human] Check suggestions and "did you mean" text → helpful, inoffensive, and not leaking private titles

## Known pitfalls

- **Search index lag.** Newly created records can take a moment to appear; wait for the documented delay before filing "not found".
- **Relevance is subjective.** Report ordering problems only against a stated rule or a clear wrong-first result.
- **Offset pagination drift** under live data is a known trade-off, not always a bug.
- **Locale sort differences.** Sort order for accents and case depends on the collation; compare to the stated locale.
- **Approximate counts** ("About 1,000") are normal in search engines.
- **Debounce.** Results updating about 300 ms after typing is intended; wait before checking.
- **Search-engine rate limits** in the test tier can block rapid test runs; don't load-test third-party search services.

## Sources

1. [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) — handling special characters (checked 2026-11-16)
2. [W3C ARIA Authoring Practices: Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — autocomplete keyboard behavior (checked 2026-11-16)
3. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — 4.1.3 status messages for result counts (checked 2026-11-16)
4. [Elasticsearch: pagination and search_after](https://www.elastic.co/guide/en/elasticsearch/reference/current/paginate-search-results.html) — drift and deep paging (checked 2026-11-16)
5. [Unicode collation (UTS #10)](https://www.unicode.org/reports/tr10/) — locale-aware sorting (checked 2026-11-16)
