---
module: base
kind: base
title: Base layer (every product)
checked: 2026-11-16
---
# Base layer

Applies to every product, whatever the platform. The scout uses it to map the product, to make sure no quality characteristic is forgotten, and to add the universal checks below. Platform modules and feature packs add to it; they never replace it.

## Map the product (SFDIPOT)

Walk these seven product elements during recon and write what you find into `qa/notes.md`. Each one usually yields checks [1].

| Element | Ask | Typical checks |
|---|---|---|
| **Structure** | What is it made of? Packages, services, files, assets, third-party parts | Missing or broken assets; versions shown match the build |
| **Function** | What does it do? Every feature, command, screen and background job | Each feature does what the docs and UI promise |
| **Data** | What does it take in, store and put out? Types, sizes, cardinality, lifecycle | Boundaries, empty and huge values, persistence, export round-trips |
| **Interfaces** | How do people and other systems reach it? UI, CLI, API, files, imports, plugins | Every way in behaves the same way for the same action |
| **Platform** | What does it depend on? OS, browser, runtime, hardware, services | The supported matrix; behaviour when a dependency is missing or slow |
| **Operations** | How is it used for real? Users, environments, common and rare tasks | The top tasks end to end, as real users do them |
| **Time** | What changes over time? Sessions, timeouts, schedules, time zones, concurrency | Expiry, clock and time-zone edges, two things at once |

## Don't forget a quality characteristic (ISO/IEC 25010:2023)

Check that the plan says something, even "out of scope", about each of the nine characteristics [2]:

1. **Functional suitability:** complete, correct and appropriate.
2. **Performance efficiency:** time, resources and capacity.
3. **Compatibility:** co-existence and interoperability.
4. **Interaction capability** (usability): learnable, operable, error-protecting, accessible, inclusive.
5. **Reliability:** faultless, available, fault-tolerant, recoverable.
6. **Security:** confidentiality, integrity, accountability, authenticity, resistance.
7. **Maintainability:** for products the user ships to developers (libraries, APIs, CLIs), mostly clear errors and stable interfaces.
8. **Flexibility** (portability): installable, adaptable, replaceable.
9. **Safety:** for anything that can harm people, money, data or property.

## Name the oracle

Every check and every bug says how we know what is right (its `Source`). Use the first that applies [3]:

1. **Claims:** the README, docs, help text, UI copy, marketing, the spec or the user's answer.
2. **Purpose and user desires:** what the user is clearly trying to do.
3. **The product itself:** the same thing done another way in the same product should behave the same way.
4. **History:** it used to work in an earlier build.
5. **Comparable products and the world:** platform conventions, how similar products behave, how things work outside software (money adds up, dates exist).
6. **Image and statutes:** embarrassing in public, or against a law or standard.

If no oracle gives an answer, the expected result is a **question for the user**, not a guess (or, on Autopilot, an "assumed" expectation, marked as such).

## Universal check seeds

Adapt these to the product. Write real names, data and expected text.

### Smoke (the intake gate)
- [high · auto] Build or install from a clean state → succeeds with no errors {smoke}
- [high · agent] Start the product and reach its main screen, command or endpoint → it loads within the stated or a reasonable time, with no error {smoke}
- [high · agent] Do the single most important task end to end → it completes and the result persists {smoke}
- [high · auto] Run the project's own tests, type checks and linter → they pass, or their failures are recorded as the baseline {smoke}

### Inputs and data
- [high · agent] Required fields empty; whitespace only; leading and trailing spaces → clear message, nothing saved, or trimmed consistently
- [medium · agent] Boundaries: 0, 1, the max, max+1, negative, decimal where an integer is expected → accepted or rejected with a clear message, never a crash
- [medium · agent] Zero, one and many: no items, one item, a long list (100+) → each state looks right and pages or scrolls
- [medium · agent] Long text (500+ characters, one unbroken word), emoji, accents, CJK and right-to-left text, quotes and angle brackets → stored and shown intact, layout holds, nothing executes
- [medium · agent] Paste instead of type; autofill; drag and drop where offered → same result as typing
- [high · agent] Follow the data: create → view → edit → delete → it's gone everywhere it appeared (lists, counts, search, exports)
- [medium · agent] Duplicate submission (double-click, Enter twice, retry after a slow response) → one record, not two

### State and interruptions
- [high · agent] Restart the product (reload, relaunch, re-run) after making changes → the changes are still there
- [medium · agent] Back, forward, refresh and deep links mid-flow → no lost data without a warning, no broken page
- [medium · agent] Interrupt a long task (close, lose network, cancel) → it recovers or says what happened; no half-saved state
- [medium · agent] Two windows, tabs or sessions doing the same thing → last change wins clearly, or there's a conflict message; no silent loss
- [medium · agent] Session or token expiry mid-task → a clear prompt to sign in again, and the work isn't lost

### Universal UI states (where there's a UI)
- [high · agent] Loading: every slow view shows that it's working → no blank screen or frozen control
- [high · agent] Empty: every list or dashboard with no data → a helpful empty state, not a broken layout or "undefined"
- [high · agent] Error: force a failure (bad input, server error, offline) → a human message with a way out, not a stack trace or a raw error code
- [medium · agent] Offline or slow network (throttle) → stated behaviour, or a clear message
- [medium · agent] Keyboard only: Tab through the main flow → every control reachable, visible focus, a logical order, no trap
- [medium · agent] Small and large windows (phone width 390px, 1280px, a very wide screen) and 200% zoom → nothing cut off, overlapping or unreachable

### Content quality
- [medium · agent] Read every screen and message in the core flows → no typos, placeholder or lorem ipsum text, "TODO", "undefined", "null", "NaN" or "[object Object]"
- [medium · agent] Images, icons and media → all load; none stretched or missing; alt text where there's a web UI
- [low · agent] Names, terms and capitalisation → consistent across screens, docs and messages
- [medium · agent] Dates, times, numbers and currency → correct and consistent formatting for the locale

### Errors and logs
- [high · agent] Watch the console, terminal and server log during every check → no errors or unhandled exceptions; warnings noted
- [medium · agent] Error messages → say what happened and what to do; never leak stack traces, file paths, keys or other users' data

### Consistency with the product's own claims
- [high · agent] Every feature the README, store listing or landing page claims → exists and works as described
- [medium · agent] Every link, button and menu item → goes somewhere real; nothing is a dead end or a stub
- [medium · agent] Help text, tooltips and onboarding → match what the product actually does today

## Exploratory charters

Each area gets at least one charter in `full` passes and when it's new. A charter is a mission, a time box (default 20 minutes of agent time) and notes [4]. Useful tours:

- **The money tour:** the paths that earn, save or cost the user money, or that the business depends on.
- **The landmark tour:** jump between the main screens in unusual orders.
- **The data tour:** follow one piece of data from entry to every place it shows up.
- **The bad-neighbour tour:** two users, roles or sessions at once.
- **The interruption tour:** cancel, back out, lose connection and restart at every step.
- **The garbage tour:** the worst input you can think of in every field.
- **The claims tour:** every promise in the docs, UI and marketing.

A charter that finds a problem files a candidate bug; one that finds nothing writes one paragraph of notes saying what was covered.

## Human-only checks

- [human] First impression: use the main flow once as a new user → is anything confusing, ugly or slow enough that you'd give up?
- [human] Brand and tone: read the main screens → do they look and sound the way you want?

## Known pitfalls

- **Don't report the test environment.** A dev server's warnings, slow cold starts or missing production keys aren't product bugs unless they leak into the product's behaviour.
- **A success message isn't proof.** Check the end state (the saved record, the file, the email in the catcher), not the toast.
- **Retry once before you call it.** A single failure might be flakiness; record intermittent failures as n/N.
- **Read the product's own scanners first** (linters, `npm audit`, Lighthouse, platform security advisors). Triage what they say rather than rediscovering it.

## Sources

1. [J. Bach, Heuristic Test Strategy Model v6.3](https://www.satisfice.com/download/heuristic-test-strategy-model) — product elements (checked 2026-11-16)
2. [ISO/IEC 25010:2023, product quality model](https://www.iso.org/standard/78176.html) — the nine characteristics (checked 2026-11-16)
3. [M. Bolton, FEW HICCUPPS](https://www.developsense.com/blog/2012/07/few-hiccupps/) — consistency oracles (checked 2026-11-16)
4. [J. Bach, Session-Based Test Management (2000)](https://www.ida.liu.se/~TDDD04/labs/2019/exploratory_testing/stqe-sbtm.pdf) — charters, time boxes, debriefs (checked 2026-11-16)
