---
module: performance
kind: feature
title: Performance basics
checked: 2026-11-16
---
# Performance basics

Covers everyday performance a user feels: startup, screen and page load, responsiveness, memory over a long session, battery and CPU on mobile, behaviour on slow networks and devices, and large data sets. It is not load or stress testing of servers (never run that against production or third-party services). Goes with every platform module; `apis-backend.md` covers server latency, `offline-sync.md` covers slow and flaky networks in depth.

## Signals

- Always relevant. Stronger when the README or store page claims "fast", "instant", "real-time" or gives numbers; when lists or tables can get large; when the product is mobile, a game, or media heavy.
- Files: `lighthouserc.*`, bundle analyser config (`webpack-bundle-analyzer`, `rollup-plugin-visualizer`, `next build` size report), `web-vitals` dependency, Sentry/Datadog performance config, `perf` budgets in CI, benchmark folders.

## Kickoff questions

1. Does the product state any speed or size claim, or have a budget? (best guess: none; use the web and platform defaults below)
2. What is the slowest device or network users really have? (best guess: mid-range phone on a slow 4G connection)
3. How large can the data get for one user? (best guess: 10,000 rows of the main item)

## Drivers

1. **Lighthouse (CLI or CI).** `lighthouse <url> --output=json --only-categories=performance` in lab mode, mobile emulation (default) and desktop (`--preset=desktop`). Run 3 times and take the median. Reports LCP, CLS, TBT (a lab stand-in for INP), FCP, Speed Index. Limit: lab data isn't field data and can't measure INP.
2. **Playwright with tracing and CDP throttling.** Use Chromium's CDP: `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate` (for example 4× slowdown) to simulate a slow phone. Use `page.evaluate` with `PerformanceObserver` for `largest-contentful-paint`, `layout-shift`, `event` (INP-like) entries; `performance.measure` for app marks; `page.tracing`/`browser.startTracing` for traces. Observe numbers, not screenshots.
3. **Bundle and asset analysis.** The build's own size report plus the visualiser; `du`/`ls -l` on `dist/`; check gzip or brotli transfer sizes in the network log. Deterministic and cheap.
4. **Field data where it exists.** The Chrome UX Report (PageSpeed Insights shows it for public sites with enough traffic), the product's real-user monitoring (Sentry, Vercel Speed Insights), Play Console Android vitals, Xcode Organizer. Read-only.
5. **Platform profilers.** Android: Android Studio Profiler, `adb shell dumpsys meminfo|gfxinfo|batterystats`, `adb shell am start -W` for startup. iOS: Xcode Instruments (Time Profiler, Allocations, Leaks), MetricKit, `XCTMetric` in XCTest. Windows: Windows Performance Recorder/Analyzer, Task Manager, `Get-Counter`. macOS: Instruments, Activity Monitor. Desktop and Electron: DevTools Performance and Memory tabs.
6. **Soak scripts.** A Playwright or UI Automation loop repeating the main task for 30 to 60 minutes while sampling memory (`performance.memory` in Chromium, `process.memoryUsage()`, OS counters).

**Can't be driven here:** real-device battery drain and thermals, true low-end hardware speed, real mobile-network variance, GPU frame pacing on a specific phone, and field INP for an unreleased product. Those become device or human checks. CPU throttling in a desktop browser is only a rough proxy for a phone.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Lighthouse mobile on the home page and the main app screen; startup/first screen under the budget |
| check | Smoke, plus changed screens, bundle size diff against the last build |
| full | Pages/screens × (fast network, slow 4G, offline-then-online) × (desktop, 4× CPU throttle) × data size (empty, typical, large) |
| release | Full, plus 30-minute soak, real mid-range phone and low-end PC checks, field data review |

Dimensions: network profile, CPU/device class, data volume, cold vs warm cache, cold vs warm start, session length.

## Check catalogue

### Budgets and claims
- [high · agent] Collect every speed or size claim in docs, store listing and UI copy ("loads in under 2 seconds", "instant search", "under 10 MB") → each becomes a numbered budget and is measured {smoke}
- [medium · agent] No claims found → adopt defaults: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (Core Web Vitals "good", 75th percentile), and record them as assumed budgets
- [medium · auto] Compare against the previous build's numbers if they exist → no regression beyond 10% (or the project's own threshold) without a note

### Startup and load time
- [high · auto] Web: Lighthouse mobile, median of 3 runs, on landing and main app page → LCP ≤ 2.5 s, CLS ≤ 0.1, TBT low (≤ 200 ms is a common lab target); record FCP and Speed Index {smoke}
- [high · agent] Web: measure LCP, CLS and event timings with `PerformanceObserver` in a Playwright run with 4× CPU and slow-4G throttling → within the budget or the gap is recorded
- [high · agent] Mobile and desktop cold start (process killed, nothing cached) → the first usable screen appears within the budget (use the product's claim; with none, record the time as a baseline); a splash isn't left on screen {smoke}
- [medium · agent] Warm start and resume from background → faster than cold start; state is intact
- [medium · agent] First load after install or update (cache empty, migrations run) → acceptable and shows progress if it takes more than about a second
- [medium · agent] Every route or screen change in the main flow → shows content or a loading state within about a second; no frozen UI
- [medium · agent] Skeletons and spinners → don't flash for fast loads and don't hang forever on slow ones; a timeout message appears

### Responsiveness and layout stability
- [high · agent] Click, tap, type and scroll in the main flow under 4× CPU throttle → the interface responds within about 200 ms; no input lag, dropped keystrokes or frozen frames; long tasks (over 50 ms) listed
- [medium · agent] CLS: load pages and watch for jumping content (late images without dimensions, banners, web-font swaps, ads) → total shift ≤ 0.1
- [medium · agent] Scrolling a long list or feed → stays smooth; no jank when images load
- [medium · agent] Animations and transitions → stay smooth at 60 fps on target hardware; they don't block input
- [low · agent] Typing in a search box, autocomplete or filter with big data → debounced; no request per keystroke storm

### Bundle, assets and network
- [high · auto] JavaScript, CSS, image and font sizes on first load (transfer and parsed) → under the project's budget; with no budget, record the sizes and the biggest 5 modules as a baseline and flag anything surprising
- [medium · auto] Source of large dependencies (moment, lodash full import, whole icon sets) → none pulled in for one function; code-splitting for routes and heavy widgets
- [medium · auto] Images → modern formats (WebP/AVIF), sized to display, lazy-loaded below the fold, with width and height set; no 4 MB hero photo
- [medium · auto] Compression and caching headers → text assets compressed (brotli/gzip); hashed static files have long cache lifetimes; HTML isn't cached forever
- [medium · agent] Number of requests and duplicates on first load → no repeated identical API calls, no waterfall of dependent requests that could run in parallel
- [medium · agent] Fonts → preloaded or swapped without long invisible text (`font-display`)
- [low · agent] Third-party scripts (analytics, chat, tag managers) → measured; blocking ones deferred; total third-party weight noted
- [medium · agent] API calls on the main flow → each responds within the budget (use the product's claim; with none, record the times as a baseline); slow queries and missing indexes are flagged when the database is visible

### Slow network and slow device
- [high · agent] Throttle to slow 4G (about 1.6 Mbps down, 150 ms RTT) and repeat the main flow → completes with working loading states; no timeout without a message {smoke}
- [medium · agent] Offline mid-flow, then back online → stated behaviour; no lost input; no infinite spinner (see `offline-sync.md`)
- [medium · agent] High latency (500 ms+) with packet loss → retries or a clear error; no double submit
- [medium · agent] 4× and 6× CPU throttle → still usable; heavy screens (charts, editors, maps) stay interactive
- [medium · device] A real low-end phone or old PC → the main flow is usable; record the model and OS
- [medium · agent] Slow responses from one API while others are fast → the page shows partial content; one slow call doesn't block everything

### Large data sets
- [high · agent] Load 1,000, 10,000 and 100,000 rows (or the biggest the product allows) of the main item with test data → lists paginate, virtualise or stream; the UI stays responsive; memory stays bounded
- [medium · agent] Search, sort, filter and export on the large set → finish in a stated or reasonable time; a progress indicator for longer than about 1 second; cancel works
- [medium · agent] Import a large file (the product's max size) → no freeze; progress shown; no out-of-memory crash
- [medium · agent] Long text, many attachments and a very long single item (a 50,000-word document, a 10,000-layer file) → opens, scrolls and saves
- [medium · agent] Database queries on the large set (visible in logs or a query plan) → no full-table scans on the main screens; no N+1 query pattern
- [low · agent] Empty to full growth: time the main screen at 10 items vs 10,000 → growth is not worse than roughly linear

### Memory, CPU and long sessions
- [high · agent] Soak: repeat the main task for 30 minutes (open/close screens, add and delete items, switch routes) while sampling memory → memory returns near baseline after garbage collection; no steady climb; no growing count of DOM nodes, listeners or timers
- [medium · agent] Heap snapshot comparison before and after 20 repetitions (Chromium DevTools or `performance.measureUserAgentSpecificMemory`) → no retained detached DOM nodes or growing object classes
- [medium · agent] Idle for 10 minutes on a screen → CPU near zero; no busy polling, animation loops or runaway timers in the background tab
- [medium · agent] Background tab or minimised app → timers and rendering throttle; no CPU spikes
- [medium · auto] Desktop and Electron: process memory and CPU in Task Manager or `ps` during idle and heavy use → within the stated or a sensible limit (compare to the product's claim or a similar app)
- [medium · agent] WebSocket, SSE and polling connections → closed on logout and route change; no growth in open connections over time
- [medium · agent] Logs and local storage growth over a long session → bounded; no unbounded cache or log file

### Mobile CPU, battery and thermals
- [high · device] Use the main flow for 15 minutes on a real phone and note battery percent and temperature → no abnormal drain for the activity (compare with similar apps on the same phone) and no warm-to-the-touch device {smoke}
- [medium · device] Background behaviour: send to background for 30 minutes → no CPU, network or location use unless the product declares it; check with `adb shell dumpsys batterystats` or Xcode energy gauges
- [medium · device] Android: check ANR and jank counters (`dumpsys gfxinfo`) and Android vitals thresholds (user-perceived crash and ANR rates) for a released build → below the bad-behaviour thresholds
- [medium · device] Low-power mode and data-saver on → the app still works; heavy tasks pause as designed
- [low · device] App size on disk after install, and cache growth after a week of use → matches the claim; the cache can be cleared

### Server-side basics (not load testing)
- [medium · agent] Time 20 sequential calls to the main endpoints in a test environment → p50 and worst are recorded; no one-off multi-second outliers without a reason
- [medium · agent] Cold start of serverless functions → first call after idle is slow but within the budget; a loading state covers it
- [low · agent] Cache hit vs miss → cached responses are measurably faster; stale data isn't served past its stated lifetime
- [medium · auto] Run any bundled benchmarks or performance tests the project already has → they pass their thresholds

## Gates

- Web launch gate L14 (performance smoke) in `../gates/web-launch.md`.
- Google Play Android vitals thresholds, and store claims about size and launch time, in the store gates.

## Human-only checks

- [human] Use the product on a real mid-range phone over a throttled or poor connection for the top task → does it feel fast enough that you wouldn't give up?
- [human] Leave the product open all day or overnight on a real device → still responsive, not hot, battery drain reasonable.
- [human] Judge animation smoothness and scrolling feel on real hardware → smooth to the eye.
- [human] Decide whether a number that misses a default budget is acceptable for this product → accept or file.

## Known pitfalls

- **Dev servers are slow.** Measure the production build on a production-like host, never `next dev` or `vite`.
- **First Lighthouse run is noisy.** Use the median of at least 3; ignore differences under about 5 points.
- **Lighthouse can't measure INP.** TBT is a proxy; don't call it INP.
- **Lab CWV differs from field CWV.** The field value at the 75th percentile decides "good"; lab scores are for regressions.
- **Extensions and open DevTools slow pages.** Use a clean automation profile.
- **Memory climbs until garbage collection.** A sawtooth is normal; a rising floor after forced GC is the leak.
- **Cold caches look slow.** Compare cold with cold.
- **Headless and virtual machines have no GPU.** Don't judge frame rates there.
- **Third-party scripts dominate many scores.** Report them as third-party, not as the product's own code.
- **Don't load-test production or third-party APIs.** Keep request counts small and in a test environment.

## Sources

1. [web.dev: Web Vitals](https://web.dev/articles/vitals) — LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile; lab tools can't measure INP (checked 2026-11-16)
2. [web.dev: INP becomes a Core Web Vital](https://web.dev/blog/inp-cwv-launch) — INP replaced FID in March 2024 (checked 2026-11-16)
3. [Lighthouse overview](https://developer.chrome.com/docs/lighthouse/overview) — CLI, DevTools, CI (checked 2026-11-16)
4. [Android vitals](https://developer.android.com/topic/performance/vitals) — bad-behaviour thresholds for crash and ANR rates (checked 2026-11-16)
5. [Vercel production checklist](https://vercel.com/docs/production-checklist) — Speed Insights and Core Web Vitals monitoring (checked 2026-11-16)
6. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — indexes, `pg_stat_statements`, load tests (checked 2026-11-16)
7. [Playwright: Emulation](https://playwright.dev/docs/emulation) — emulation limits (checked 2026-11-16)
