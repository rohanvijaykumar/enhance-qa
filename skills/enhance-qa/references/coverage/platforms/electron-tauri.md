---
module: electron-tauri
kind: platform
title: Electron and Tauri desktop apps
checked: 2026-11-16
---
# Electron and Tauri desktop apps

Covers desktop apps whose interface is web content in a shell: Electron (bundled Chromium plus Node.js) and Tauri (the system web view plus a Rust core). It covers driving the web layer, the bridge between web and native code (the biggest risk), auto-update, code signing per OS, native menus and tray, deep links and single-instance behaviour. It always goes with `web-app.md` for the web layer and with the desktop OS modules it ships to (`windows-desktop.md`, `macos-desktop.md`, `linux-desktop.md`). Gates: `../gates/windows-code-signing.md`, `../gates/macos-notarization.md`, `../gates/microsoft-store.md`. It also goes with `../features/installers-updaters.md` and `../features/security.md`.

## Signals

- `package.json` depends on `electron`, `electron-builder`, `electron-forge` or `@electron/packager`; files named `main.js`, `main.ts`, `preload.js`, `forge.config.js`.
- `src-tauri/` with `tauri.conf.json`, `Cargo.toml` with `tauri`, a `capabilities/` folder, `@tauri-apps/api` in `package.json`.
- README words: "Electron", "Tauri", "desktop app", "auto-update".

## Kickoff questions

1. Electron or Tauri, which version, and which OSes ship (Windows, macOS, Linux)? (best guess: from `package.json` and `tauri.conf.json`; all three)
2. Does the web layer load only bundled files, or also remote pages or user content? (best guess: bundled files only; check for `loadURL` and remote iframes)
3. Is there an auto-updater and signing set up, and who holds the certificates? (best guess: yes to the updater; the user holds the keys and an agent never touches them)

## Drivers

1. **Project tests.** `npm test`, Vitest or Jest for the web layer, `cargo test` for the Tauri Rust core. Run first and record as baseline.
2. **Playwright for Electron.** `_electron.launch()` starts the packaged or dev app and returns a Playwright page per window; it can also evaluate in the main process. Use the accessibility snapshot scoped to the window and a locator; screenshots at 1280×800 or smaller. It drives the web layer only, so native menus, the tray, dialogs and notifications are not visible to it [1].
3. **WebDriver for Tauri.** Through `tauri-driver` (Windows and Linux) or the embedded WebDriver server with the WebdriverIO Tauri service, which also covers macOS. `tauri-driver` alone doesn't work on macOS because there's no WKWebView driver tool [2]. Check the current docs before choosing.
4. **Chrome DevTools Protocol.** Launch Electron with `--remote-debugging-port=9222` in a test run and connect with Playwright `connectOverCDP` or Chrome DevTools MCP. Only in debug runs; never ship with the port open.
5. **Static inspection of the package.** For Electron, `npx asar extract app.asar` to read the shipped files, `npx @electron/fuses read --app <path>` to read the fuse state [3]; for Tauri, read `tauri.conf.json` and the `capabilities/*.json` files [4]. `cargo audit`, `npm audit`, `semgrep` or `electronegativity` for known weak patterns.
6. **OS-level drivers** for what the web layer can't reach: Windows UI Automation, macOS accessibility scripting, AT-SPI on Linux (see the desktop OS modules); shell tools for installers and signatures (`signtool`, `codesign`, `spctl`, `lintian`).
7. **Computer use / screenshots.** Last resort for native menus, the tray and dialogs.

**Can't be driven here:** the system tray, native menus on macOS, notification centre, OS file dialogs, protocol-handler registration by the browser, code signing with real certificates, and Gatekeeper or SmartScreen first-run prompts. Tauri on macOS and Linux needs those OSes. Each becomes a human or device check; certificates and notarisation credentials are never handled by an agent.

## Parallel lanes

Most Tauri apps use the single-instance plugin and keep their data under the app ID, so a second copy only focuses the first. Electron apps that call `requestSingleInstanceLock` do the same. Don't test them on one lane: give each lane its own identity. The general rules are in `../../platforms/drivers.md`, "Several copies at once"; for these apps:

- **Tauri: a lane build per extra lane, with its own app ID.** Tauri merges `--config` (a JSON string or a JSON file) over `tauri.conf.json` at build time, so the config file stays untouched [10]:
  ```
  CARGO_TARGET_DIR=qa/.state/lanes/target npx tauri build --no-bundle --config qa/.state/lanes/lane2.json
  ```
  with `lane2.json` holding `{"identifier": "com.example.app.qa2"}` (Tauri 2; on Tauri 1 the key is `tauri.bundle.identifier`). On Windows PowerShell, set `$env:CARGO_TARGET_DIR` first.
  - The separate target folder keeps the product's own build as it was. Dependencies compile once there, so each later lane build only recompiles the app.
  - Copy each lane's program into `qa/.state/lanes/<n>/` before the next lane build overwrites it, together with what the build put beside it: sidecar binaries (`bundle.externalBin`) and resource folders (`bundle.resources`).
  - The new ID gives the lane its own single-instance lock, its own data folders (`%APPDATA%\<id>` and `%LOCALAPPDATA%\<id>` on Windows, `~/Library/Application Support/<id>` on macOS, `~/.local/share/<id>` and `~/.config/<id>` on Linux) and, on Windows, its own WebView2 profile. Resetting a lane means quitting it and deleting its folders.
- **Electron: a user data folder per lane.** Electron counts a copy as a second instance only when it shares the user data folder (`app.getPath('userData')`) with the first [11], and that folder also holds the settings, so a lane needs its own. Ways to get one, in order:
  - the app's own profile or data-folder option;
  - Chromium's `--user-data-dir=<lane folder>` switch (with Playwright, in `_electron.launch`'s `args`). Electron doesn't document it, so prove it took effect;
  - `XDG_CONFIG_HOME` per lane on Linux, where Electron puts its app data;
  - a lane build with a different app name, overridden on the build command line (electron-builder's `-c.extraMetadata.*`), because the folder is named after the app.
- **Ports per lane:** `tauri-driver --port <p> --native-port <p+1>`; for the Chrome DevTools Protocol, `--remote-debugging-port=<9222+n>` for Electron, or the environment variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<9222+n>` for Tauri on Windows. Start lanes one at a time and wait until each answers on its port: starting two at once has lost a port.
- **Lane 1 keeps the real app ID** for notifications (Windows ties them to the installed app), deep links, file associations, single-instance checks, the updater and installers.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | dev or packaged build on the host OS, main window, main task |
| check | smoke, plus the packaged (not dev) build, plus changed features and IPC calls |
| full | pairwise over OS (Windows, macOS, Linux) × architecture × build (dev, packaged, signed) × install scope × update state (fresh, updated) × theme × scale |
| release | signed and notarised packaged build on every OS, update from the previous release, human checks |

Dimensions: OS and version; architecture (x64, arm64); packaged vs dev; signed vs unsigned; per-user vs per-machine install; update channel; light and dark; display scale; offline; first run vs returning user.

## Check catalogue

### Smoke
- [high · auto] Install dependencies from the lockfile, build the packaged app, and run unit tests → builds; tests pass {smoke}
- [high · agent] Launch the **packaged** app (not the dev server), open the main window, do the main task, quit and relaunch → the result persists; no blank window; no console errors in DevTools or the main-process log {smoke}
- [high · auto] Run `npm audit` (or `cargo audit` for Tauri) and read the output → no unreviewed high or critical findings that affect shipped code {smoke}

### Web layer (the page content)
- [high · agent] Run the web layer checks from `web-app.md` that apply (forms, routing, states, keyboard) inside the shell → pass; differences from the browser are noted
- [high · agent] Check the window starts at a sensible size and position, remembers its size, and fits small screens → visible, resizable, not off-screen
- [medium · agent] Reload and navigate (Ctrl/Cmd+R, back, deep links to internal routes) → the app doesn't navigate to a blank or file-not-found page; unknown routes show an app page
- [medium · agent] Webview differences: Tauri uses WebView2 (Windows), WKWebView (macOS) and WebKitGTK (Linux); Electron bundles Chromium → check CSS and JS features used work on every engine shipped; with Tauri, test each OS
- [medium · agent] Fonts, emoji, text rendering, scrollbars and form controls on each OS → acceptable; no layout break
- [medium · agent] Right-click menu, text selection, drag and drop of files into the window, print and zoom shortcuts → work as intended, or are disabled on purpose; default browser context menus don't expose "Inspect" in release unless wanted
- [low · agent] DevTools in the packaged build → disabled unless a documented debug option; F12 and the menu don't open it {security}

### IPC and bridge security
- [high · auto] Electron: read `BrowserWindow` options → `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no `webSecurity: false`, no `allowRunningInsecureContent`; remote content is loaded in a separate restricted window {security} [5]
- [high · auto] Electron: read the preload script → exposes only a small named API via `contextBridge.exposeInMainWorld`; never exposes `ipcRenderer`, `require` or whole modules; arguments are validated {security} [5]
- [high · auto] Electron: list every `ipcMain.handle` and `ipcMain.on` → each validates its arguments and checks the sender (`event.senderFrame`) and URL; none runs shell commands or reads arbitrary paths from page input {security}
- [high · auto] Tauri: read `src-tauri/capabilities/*.json` and `tauri.conf.json` → each window gets only the permissions it needs; no broad `fs`, `shell` or `http` scope such as `**`; remote URLs have no access to commands {security} [4]
- [high · auto] Tauri: list every `#[tauri::command]` → each validates input, doesn't take raw paths or shell strings from the page, and returns safe errors {security}
- [high · agent] Open the page's DevTools in a dev build and try calling the bridge with bad arguments (huge, wrong type, path traversal like `../../`, null) → rejected with a clean error; no crash; no file outside the allowed folder read or written {security}
- [high · agent] Inject `<script>` and HTML into every user-controlled field and loaded content (e.g. a note title, a markdown file) → shown as text; nothing runs; the bridge isn't reachable from injected content {security}
- [high · auto] Content Security Policy in the HTML or `tauri.conf.json` → set and strict (no `unsafe-eval`, no wildcard `script-src`); no remote scripts without need {security}
- [high · agent] `shell.openExternal` (Electron) and the opener or shell plugin (Tauri) with `file://`, `javascript:`, custom protocols and `smb://` → only `https:` (and `mailto:` if wanted) are opened; others are refused {security}
- [medium · agent] Navigation and window creation: click an external link and a `target=_blank` link; drag a link in → external links open in the default browser; `will-navigate` and `setWindowOpenHandler` block everything else {security}
- [medium · auto] Electron Fuses → `RunAsNode` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` on where supported {security} [3]
- [medium · auto] Electron version and Chromium → within the supported releases; older versions have known fixed vulnerabilities {security}
- [medium · agent] Custom protocol handlers (`app://`, `myapp://`) and file access → can't be used to read files outside the app's folders {security}
- [medium · auto] Secrets: search the packaged app and `asar` for API keys and private keys → none; tokens held in the OS keychain (safeStorage, keyring plugin) not plain files {security}

### Auto-update
- [high · agent] Update from the previous release to the new one using a test update server or channel → the app downloads, verifies, installs and restarts on the new version; settings and data kept [6]
- [high · auto] Tauri updater: signature check → updates must be signed and the public key is in the app; an update with a wrong or missing signature is rejected and can't be disabled {security} [7]
- [high · agent] Serve a tampered or unsigned update, and a downgrade → rejected with a clear message; the old version keeps working {security}
- [medium · agent] Update failure cases: no network, interrupted download, full disk, a server returning 404 or garbage → clear message; no broken half-install; app still launches
- [medium · agent] Update while a task is running and when the app is open in two instances → the app asks or waits; no data loss
- [medium · agent] Windows (Squirrel, NSIS or MSI), macOS (Squirrel.Mac, requires a signed app) and Linux (AppImage, deb) update paths → each works for its installer; Linux system packages update through the package manager, not the app
- [medium · agent] Update channels (stable, beta) and staged rollouts → a user on stable never receives a beta; release notes shown are correct
- [low · agent] "Check for updates" menu item and background checks → work; no check on every launch beyond what the user agreed to

### Code signing and installers (per OS)
- [high · auto] Windows: `signtool verify /pa /v` on the installer and main exe, with timestamp → valid; correct publisher name (see `../gates/windows-code-signing.md`) {security}
- [high · auto] macOS: `codesign --verify --deep --strict`, `spctl --assess`, `stapler validate`, hardened runtime and entitlements (JIT and unsigned memory for Electron's V8, allowed by the right entitlements only) → signed, notarised, stapled; every helper app is signed too (see `macos-desktop.md` and `../gates/macos-notarization.md`)
- [medium · auto] Linux: `lintian` or `rpmlint` for deb or rpm; AppImage runs on a clean distro; Flatpak or Snap manifest permissions are minimal (see `linux-desktop.md`)
- [medium · agent] Install and uninstall on each OS (see the OS modules) → clean; per-user and per-machine behave as documented; the Electron or Tauri app doesn't leave processes, helper services or login items behind
- [medium · agent] Architecture builds (x64, arm64, universal) → each installs and starts on its own architecture; the website links the right one
- [medium · auto] Packaged size and contents → no source maps with secrets, test files, `.env`, extra `node_modules` or development tools shipped

### Native menus, tray, notifications and windows
- [high · agent] Application menu on each OS → standard items exist (macOS: app menu with About, Settings, Hide, Quit; Windows and Linux: File, Edit, View, Help); accelerators follow the OS (Cmd on macOS, Ctrl elsewhere); Edit menu has copy and paste roles so shortcuts work in text fields
- [medium · agent] Tray or menu bar icon → icon visible in light and dark and at high DPI; the menu works; "Quit" really quits (and closing the window hides to tray only if designed)
- [medium · agent] Close, minimise and quit behaviour: close last window on macOS (app keeps running) vs Windows and Linux (quits) → matches the convention or the documented choice; Cmd+Q and Alt+F4 work
- [medium · agent] Native notifications and their click action → the OS notification appears; clicking opens the right screen; permission handled on macOS
- [medium · agent] Native dialogs (open, save, message box) with Unicode and long paths → return the right path; cancelled dialogs don't crash
- [medium · agent] Global shortcuts, clipboard, drag and drop out of the app, and "reveal in file manager" → work on each OS, or the missing capability is stated (Wayland restricts several)
- [low · agent] Frameless, transparent or custom title bar windows → drag region, buttons, snap on Windows 11, traffic lights on macOS, and resize work

### Deep links and single instance
- [high · agent] Register the protocol and open `myapp://path?x=1` from a browser, a terminal (`start`, `open`, `xdg-open`) with the app closed and running → the app opens (or focuses) and routes to the right screen [8]
- [high · agent] Launch a second instance by clicking the icon twice and by opening a file or link while running → one window; the first instance gets focus and the arguments (`requestSingleInstanceLock`, Tauri single-instance plugin) [9]
- [medium · agent] Hostile deep links (very long, encoded, unknown host, path traversal, `javascript:` payloads) → ignored or rejected; no action without confirmation {security}
- [medium · agent] Deep link on first install and after update → protocol registration survives updates; on macOS and Linux requires the packaged or installed app, not the dev run
- [medium · agent] File associations (double-click a file type) → opens in the existing instance with the right file

### Performance and resources
- [medium · agent] Cold start time and memory at idle on the packaged app → recorded; compare with the last release; no large unexplained rise
- [medium · agent] Leave the app idle for an hour and then use it → CPU near zero at idle; memory stable; no runaway renderer or helper processes (Task Manager or Activity Monitor)
- [medium · agent] Minimise to tray and restore after a long time → app responsive; timers and sockets recover
- [medium · agent] Large files and long lists (the heaviest real use) → the UI stays responsive; heavy work runs off the main process
- [low · auto] Installer and download size against the last release → no unexplained jump

## Gates

- `../gates/windows-code-signing.md`, `../gates/macos-notarization.md` and, if used, `../gates/microsoft-store.md` and `../gates/apple-app-store.md`.
- Release blockers specific to this kind of app: `nodeIntegration` on with remote or user content, a bridge that exposes arbitrary file or shell access, unsigned or unverified updates, DevTools open in release, unsigned or un-notarised builds, a debug port left open.

## Human-only checks

- [human] On each OS you ship, install the real signed build and use the main task for 10 minutes → no first-run security warnings beyond the normal ones; it feels like a real app
- [human] Click the tray icon, the notification and the native menu items on each OS → they work and look right
- [human] Install the previous version, then let the app update itself from your real update channel on a test account → it updates and keeps data
- [human] Open a `myapp://` link from a real browser → the right app opens
- [human] Sign, notarise and publish the update → an agent never holds certificates or keys

## Known pitfalls

- **Dev run isn't packaged.** Deep links, single-instance, update, protocol registration and many security flags behave differently in `npm run dev` or `cargo tauri dev`; test the packaged build before filing.
- **The web layer only.** Playwright and WebDriver can't see native menus or the tray; a "missing" menu in a screenshot-less run isn't proof it's missing.
- **Electron DevTools warnings** (Autofill errors, "Electron Security Warning" lines) show in dev and are removed or changed in packaged builds; treat the packaged log as the truth, but still review the warning's cause.
- **Tauri webview differences.** WebKitGTK and WKWebView lag behind Chromium for new CSS and JS features; a layout fault on one OS only is often the engine.
- **macOS updates need a signed app.** Auto-update failing on an unsigned dev build is expected.
- **First launch after install is slow** (Gatekeeper scan, antivirus, cache creation); measure the second launch.
- **Antivirus and SmartScreen warnings** on new binaries are distribution risks, reported once, not product bugs.
- **Wayland restricts global shortcuts, tray and window position;** these gaps are expected on some Linux sessions.
- **Don't test updates against the production feed** or sign with real keys; use a test channel and test keys.

## Sources

1. [Playwright: Electron API](https://playwright.dev/docs/api/class-electron) — launching and driving Electron apps (checked 2026-11-16)
2. [Tauri: WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/) — `tauri-driver`, embedded WebDriver and WebdriverIO service; supported OSes (checked 2026-11-16)
3. [Electron: Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses) — fuse options and reading them (checked 2026-11-16)
4. [Tauri: Capabilities](https://v2.tauri.app/security/capabilities/) — per-window permissions and scopes (checked 2026-11-16)
5. [Electron: Security](https://www.electronjs.org/docs/latest/tutorial/security) — security checklist: context isolation, sandbox, CSP, IPC sender validation, `openExternal`, navigation (checked 2026-11-16)
6. [Electron: autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater) — update flow and platform support (checked 2026-11-16)
7. [Tauri: Updater plugin](https://v2.tauri.app/plugin/updater/) — signed updates required, signature verification (checked 2026-11-16)
8. [Electron: Deep links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app) — protocol handlers and launching from a URL (checked 2026-11-16)
9. [Tauri: Single instance plugin](https://v2.tauri.app/plugin/single-instance/) — one running instance and argument forwarding (checked 2026-11-16)
10. [Tauri: Command line interface](https://v2.tauri.app/reference/cli/) — `tauri build --config` merges JSON, JSON5 or TOML (strings or files) over the config file; `--no-bundle` skips the installers (checked 2026-11-20)
11. [Electron: app](https://www.electronjs.org/docs/latest/api/app) — a second instance is one that shares the user data folder (and on Windows the program name); default data folders per OS (checked 2026-11-20)
