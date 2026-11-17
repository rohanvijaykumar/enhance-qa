# Driving the product

The scout probes what works on this machine and with this agent, then records the chosen driver per area in `qa/notes.md` ("Drivers that work here"). Testers use what the notes say. Prefer the most reliable and the cheapest: deterministic tools first, then scripted drivers, then agent-driven UI, and computer use last.

## First, probe

Run these quietly; don't install anything without the user's OK.
- **Can this agent see images?** If not, visual checks become `human`, or use text evidence (the DOM, computed styles, accessibility names).
- **Web:**
  - `node <skill>/scripts/drive-web.mjs --check` says in one call whether Playwright is available (in the project, globally or on `NODE_PATH`) and which browser starts (Playwright's own, an installed Chrome, or Edge);
  - Playwright: `npx --no-install playwright --version`; the project's `@playwright/test`; installed browsers under `ms-playwright`;
  - agent-browser;
  - a configured Playwright or Chrome DevTools MCP;
  - the agent's own browser (the Claude desktop app's browser pane, the Codex app's browser).
- **Mobile:** `adb devices`; `emulator -list-avds`; `xcrun simctl list devices` (macOS); Maestro (`maestro --version`).
- **Desktop:**
  - Windows UI Automation (PowerShell, or `pywinauto` if installed);
  - the macOS accessibility API (`osascript`);
  - Playwright's Electron support;
  - `tauri-driver`.
- **Domain tools:** whatever the platform module names (pluginval, auval, engine CLIs, validators, MediaInfo, ffprobe).

## Web

1. **The web driver: `node <skill>/scripts/drive-web.mjs`** (a separate script from `qa`; it needs Playwright in the project, globally or on `NODE_PATH`). A tester writes a small JSON plan of steps, and the script runs them in one go. It prints a compact result: the final URL, each assertion, the texts it was asked to read, and console and page errors. It saves a screenshot only when asked or on failure. This is the cheapest way for an agent to run a UI check: one tool call per check, no page dumps.
   ```json
   {"base": "http://localhost:3000", "viewport": "390x844", "steps": [
     {"goto": "/login"},
     {"fill": {"label": "Email"}, "value": "$QA_USER_A_EMAIL"},
     {"fill": {"label": "Password"}, "value": "wrong-password"},
     {"click": {"role": "button", "name": "Sign in"}},
     {"expectText": "Incorrect email or password"},
     {"expectUrl": "/login"}
   ], "screenshot": "on-failure", "evidence": "qa/evidence/007/auth-002"}
   ```
   - Values starting with `$` are read from environment variables, so credentials never appear in plans or logs.
   - Run it with `node <skill>/scripts/drive-web.mjs plan.json`, or pipe the plan on stdin. `--help` lists every step and locator.
   - **Scope your expectations.** `expectText` searches the whole page, including the nav and footer, so "Terms" also matches the footer link on a 404 page. Use `"in": {...}` to name the region, or check the heading or title (`expectTitle`).
   - **Read the error lists in the result:** `pageErrors` (uncaught script errors), `serverErrors` (5xx), `httpErrors` (4xx, except the favicon), `failedRequests` and `console`. A check can pass its expectation and still reveal a bug there.
   - **Browsers:** it tries Playwright's own Chromium first, then the installed Google Chrome, then Microsoft Edge, each with a fresh temporary profile (never the user's). The result says which one ran (`browser`).
2. **Playwright tests or scripts written for the check,** when a plan isn't enough (uploads, multiple tabs, network mocking). Keep them under `qa/evidence/<run>/scripts/`, unless replay is on (`integrations/replay.md`).
3. **A Playwright or Chrome DevTools MCP, or agent-browser.** Use interactive-only or element-scoped snapshots and `find`, never a full snapshot after every action. In Codex, prefer CLI drivers over MCP: tool definitions add 4–6k tokens per request.
4. **The agent's own browser** (desktop app browser pane, Codex app browser). Fine for interactive sessions; record what was checked in text.
5. **Claude in Chrome / the Codex Chrome extension** drive the user's real browser with real logins. Use them only with the user's OK, never with real accounts' data, and prefer a separate browser profile.
6. **Plain HTTP** (`curl`, `fetch`) for server-rendered pages, status codes, headers, redirects, robots and sitemaps, and APIs. It's the cheapest of all.

**Logins:** log in once per test account and save the storage state to `qa/.state/sessions/<account>.json`. The web driver accepts `"storageState"` (load) and `"saveStorageState"` (save) in the plan.

## Desktop

- **Electron:** Playwright's `_electron.launch`, driving the web layer.
- **Tauri:** WebDriver via `tauri-driver` (Windows and Linux).
- **Native Windows:** UI Automation through PowerShell (`System.Windows.Automation`) or `pywinauto`. Read the control tree scoped to the window, never the whole desktop.
- **Native macOS:** the accessibility API through AppleScript or JXA (`osascript`), scoped to the app's window.
- **Linux:** AT-SPI (`dogtail`, `pyatspi`) where available; otherwise `xdotool` plus screenshots.
- **Computer use** is the last resort: the Claude desktop app on macOS and Windows, or the Codex desktop app. Use it for a few visual or physical-feel checks, never for whole suites.

## Mobile

- **Android:** `adb` with `uiautomator dump`, which gives compact XML for the current screen. Use `adb shell input` for taps and text, `adb logcat` filtered to the app, and Maestro flows (YAML) for repeatable paths. Use the emulator for most checks; real devices are `device` checks.
- **iOS:** `xcrun simctl` to install, launch, open URLs, set location and change appearance. XCUITest, or Maestro on simulators, for UI flows. Real-device checks (cameras, push, payments, performance) are `device` checks.
- **React Native and Flutter:** Detox, Maestro or Flutter's `integration_test`, where the project has them.

## CLI, APIs and libraries

- **CLI:** run in a clean temporary directory; capture the exit code, stdout and stderr separately; test with and without a TTY; set `NO_COLOR=1` for stable output.
- **APIs:** `curl -sS -o body -w '%{http_code}'`, or a short script. Validate against the OpenAPI or GraphQL schema where one exists.
- **Libraries:** a throwaway project per supported runtime; install from the packed artefact (`npm pack`, `python -m build`), not the source tree.

## Evidence

- **Text first:** quoted output, status codes, exit codes and log lines, saved under `qa/evidence/<run>/`.
- **Screenshots:** for visual checks and failures; 1280×800 or less, cropped. **Recordings:** Playwright's `video` for interactive failures, kept short.
- **Redact** with `qa redact` before referencing a file from a bug.
