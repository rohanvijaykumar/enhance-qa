---
module: host-app-plugins
kind: platform
title: Host-app plugins (VS Code, JetBrains, Office, Figma, WordPress, Shopify)
checked: 2026-11-16
---
# Host-app plugins

Covers extensions that run inside another product: VS Code and JetBrains IDE plugins, Microsoft Office add-ins, Figma and FigJam plugins, WordPress plugins and themes' plugin-side code, and Shopify apps. The host sets the rules: lifecycle, APIs, versions and review. Use it with `web-app.md` where the plugin has a web UI, `../features/security.md`, and for VS Code release `../gates/vscode-marketplace.md`. Other marketplaces (JetBrains, AppSource, Figma, WordPress.org, Shopify) have no gate pack here; use their own review pages (sources) and `byo.md` for client checklists.

## Signals

- VS Code: `package.json` with `engines.vscode`, `contributes`, `activationEvents`, `main`; `vsce` or `ovsx` scripts; `@types/vscode`.
- JetBrains: `plugin.xml`, `build.gradle(.kts)` with `org.jetbrains.intellij` or `intellij-platform` plugin; `pluginVerifier`.
- Office: `manifest.xml` (add-in only manifest) or a unified manifest `manifest.json`; `office-addin-*` packages; `Office.onReady`.
- Figma: `manifest.json` with `editorType`, `main`, `ui`; `@figma/plugin-typings`.
- WordPress: a PHP file with a `Plugin Name:` header, `readme.txt`, `register_activation_hook`.
- Shopify: `shopify.app.toml`, `@shopify/shopify-app-*`, `extensions/` folder.

## Kickoff questions

1. Which host and which host versions must it support? (best guess: the range in `engines.vscode`, `since-build`/`until-build`, `Requirements` or `Requires at least`)
2. Where will it run: local only, or also remote (SSH, WSL, Codespaces), multisite, other hosts such as Cursor? (best guess: local only unless the README says more)
3. Does it call an outside service or need an account, and is there a test account or store? (best guess: no; if yes, user supplies a test one)

## Drivers

1. **Project tests and linters.** `npm test`, `./gradlew test`, `phpunit`, `eslint`, `phpcs`; run and record as baseline.
2. **VS Code: `@vscode/test-electron` and `@vscode/test-cli`.** `runTests({ extensionDevelopmentPath, extensionTestsPath })` downloads a VS Code build and runs Mocha tests inside the extension host with the real `vscode` API. Pass `launchArgs` to open a workspace, `--disable-extensions` for isolation and `--profile-temp` for a clean profile. Test on a minimum and a latest VS Code version [1].
3. **VS Code remote.** The Remote Development docs describe testing in containers, SSH and WSL; on Windows, use WSL or a Dev Container from the CLI; Codespaces needs a GitHub account (human). Treat remote cells as device or human unless the project already has them in CI [2].
4. **JetBrains.** `./gradlew runIde` (a sandbox IDE), `./gradlew test` (platform test framework), `./gradlew verifyPlugin` and the Plugin Verifier against the declared IDE range. UI tests via the Starter and UI test framework are heavy; use sparingly [3].
5. **Office add-ins.** `npx office-addin-manifest validate manifest.xml`, `office-addin-debugging start` for sideloading in Office on the web or desktop, and `office-addin-test-helpers` for automated tests. Word, Excel and PowerPoint on desktop aren't drivable by an agent without UI automation, so use Office on the web with a test Microsoft 365 account the user supplies [4].
6. **Figma.** Run the plugin from the desktop app's "Import plugin from manifest" in a scratch file. No headless host exists, so the agent checks type checks, build and logic, and a human runs it in Figma. Use `@figma/plugin-typings` and unit tests for pure logic [5].
7. **WordPress.** `wp-env` or `wp-now` (Docker) for a throwaway site; WP-CLI to activate, deactivate and uninstall; `phpunit` with the WP test suite; the Plugin Check plugin (`wp plugin check`) and `phpcs` with WordPress coding standards; test on PHP minimum and latest and on multisite [6].
8. **Shopify.** `shopify app dev` against a development store the user owns (never a live store), Shopify CLI `app deploy` only to a dev app. Review basics are in the app requirements checklist [7].
9. **Playwright** for any web UI the plugin shows (WordPress admin pages, Shopify embedded app, Office task pane in a browser, a webview in VS Code through its own debug port). Scoped accessibility snapshots; screenshots at 1280×800 or less.

**Can't be driven here:** real Office desktop clients, Figma desktop UI, JetBrains UI beyond the platform test framework, VS Code Codespaces and SSH to real machines, and any marketplace review. Live production stores, sites and documents are never touched; checks use throwaway sites, dev stores, scratch files and test accounts.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | latest host version, clean profile or site, install the built package, activate, run the main command |
| check | smoke cell, plus the changed commands and settings, plus the minimum host version |
| full | pairwise over host version × OS × workspace type × other plugins × language |
| release | minimum, latest and one middle host version; every claimed environment (remote, multisite, other hosts); upgrade from the last published version; human checks |

Dimensions: host version (minimum supported, current, pre-release); OS; workspace (empty, single folder, multi-root, huge repo, untrusted/restricted mode, virtual workspace); remote kind; PHP version and multisite (WordPress); other installed plugins; UI theme and language.

## Check catalogue

### Install, activation and lifecycle
- [high · auto] Build and package (`vsce package`, `./gradlew buildPlugin`, WordPress zip, Office/Figma manifest) → produces an installable artefact without errors; the package contains no secrets or test fixtures {smoke}
- [high · agent] Install the packaged artefact into a clean host profile and activate it → no error notification; the main command appears and works {smoke}
- [high · agent] Measure activation: VS Code `Developer: Show Running Extensions` and the startup profile; JetBrains startup activity; WordPress page-load timing with Query Monitor → activation is lazy (specific `activationEvents`, not `*`), and cost is small and recorded as a number
- [medium · auto] Check `activationEvents` and `contributes` against the features → every command activates the extension; no command works only if another one ran first
- [medium · agent] Disable, re-enable, update and uninstall the plugin → each works without restart prompts the docs don't mention; uninstall leaves no orphaned settings, files or processes that the docs don't state
- [high · agent] Upgrade from the last published version with existing user data and settings → data and settings are kept or migrated; no reset
- [medium · agent] Reload the window or restart the host with the plugin active → state restores; no duplicated UI, listeners or status items
- [medium · agent] Kill a long-running child process or language server the plugin started → the plugin restarts it or reports a clear error; no zombie processes remain after the host closes

### Commands, settings and UI
- [high · agent] Run every command from the command palette (VS Code), Tools and Actions menus (JetBrains), ribbon or task pane (Office), plugins menu (Figma) → each does what its title says; none throws "command not found"
- [medium · auto] Compare the settings in the manifest with the code that reads them → every setting is used; defaults match the docs; invalid values give a clear message
- [medium · agent] Change settings while the plugin is running, at user, workspace and (VS Code) folder level → the change takes effect or says a reload is needed; precedence is correct
- [medium · agent] Use light, dark and high-contrast themes and 200% zoom (webviews, tool windows, task panes) → text readable, no hard-coded colours that vanish {a11y}
- [medium · agent] Tab through the plugin's views, webviews and dialogs → keyboard reachable with visible focus and labels; screen reader names exist {a11y}
- [medium · agent] Use the plugin in another language or locale setting of the host → strings follow the host language or fall back to English; no raw keys
- [low · agent] Check keybindings, context menus and status bar items for conflicts with the host's defaults → none shadow built-ins unexpectedly

### Host compatibility and environments
- [high · auto] Run the host's compatibility tool: VS Code tests on `engines.vscode` minimum and latest; JetBrains Plugin Verifier on the declared IDE range; Office manifest validate; WordPress Plugin Check → no errors; no use of internal or removed APIs {smoke}
- [high · agent] Open a multi-root workspace (VS Code) or a project with multiple modules (JetBrains) → the plugin handles each root; settings and results don't mix up folders
- [medium · agent] Open a workspace in restricted mode (untrusted) and a virtual workspace (VS Code) → the plugin respects `capabilities` declarations; no code execution from workspace files without trust {security}
- [medium · device] Run the plugin in VS Code Remote (WSL, SSH, Dev Container, Codespaces) → works with the right side of the remote split (UI versus workspace extension kind); paths, shells and environment are correct
- [medium · agent] Use a huge repository or file (100,000 files or a 50 MB file) → plugin stays responsive; scans are cancellable and don't freeze the UI thread
- [medium · agent] Install alongside popular plugins in the same area (other linters, formatters, language servers) → no conflict, double handling or fighting formatters
- [medium · agent] Run on each OS the manifest claims (Windows paths with spaces and drive letters, macOS case-insensitive, Linux) → paths and line endings handled; no hard-coded separators
- [low · agent] Run in a forked host (Cursor, VSCodium with Open VSX) if claimed → works, or the README lists the gap

### Data, network and security
- [high · agent] Record network calls from the plugin during its main flows → only declared hosts; nothing sent before the user opts in; no source code or document contents leave the machine unless documented {security}
- [high · agent] Check how credentials and tokens are stored (VS Code `SecretStorage`, JetBrains `PasswordSafe`, WordPress options, Shopify env) → never in plain settings files, logs or the repo {security}
- [high · agent] WordPress: check capability and nonce checks on every admin action and AJAX endpoint, escape output, and prepare SQL → unauthenticated and low-role requests are rejected; no injection or XSS {security}
- [high · agent] Shopify: check webhook HMAC verification, session token validation, scopes requested versus used, and mandatory privacy webhooks → bad signatures rejected; no unused scopes {security}
- [medium · agent] Office: check that the task pane's pages load only over HTTPS, `AppDomains` are minimal and the add-in handles being offline → no mixed content; clear error
- [medium · agent] Figma: check network access in the manifest (`networkAccess.allowedDomains`) and that document data isn't sent out without notice → only allowed domains {security}
- [medium · auto] Run `npm audit`, `composer audit` or Gradle dependency checks → no unaddressed high or critical issue {security}

### Host-specific checks
- [high · auto] JetBrains: set `since-build` and `until-build`, run Plugin Verifier on every IDE in range → no compatibility problems or "internal API" warnings that block marketplace approval
- [medium · agent] JetBrains: check dynamic plugin loading and unloading (no restart needed) if declared; check that background work uses the platform's progress and read/write action rules → no "slow operation on EDT" errors in `idea.log`
- [high · auto] Office: validate the manifest and sideload in Office on the web with a test account; check `Office.onReady` and the requirement sets used → loads on each claimed host (Word, Excel, Outlook, PowerPoint) and platform
- [medium · agent] Office: open the same add-in on Windows, Mac and web where claimed (device) → same behaviour; unsupported requirement sets degrade cleanly
- [medium · agent] Figma: run on an empty page, a huge file, and a file with locked, hidden and component-instance layers → no crash; large selections are processed in chunks; the UI shows progress; undo behaves
- [high · agent] WordPress: activate, deactivate and delete the plugin on a throwaway site, then inspect options, tables and cron events → activation creates what's needed; uninstall (`uninstall.php`) removes data only when the docs say; no fatal error on activation
- [high · auto] WordPress: run Plugin Check, `phpcs` (WordPress standards) and the plugin on the minimum and newest PHP and WordPress versions → no errors; no PHP notices or deprecations with `WP_DEBUG` on
- [medium · agent] WordPress multisite: network-activate and per-site activate; switch blogs; check tables use `$wpdb->prefix` → settings are per site where intended; no cross-site data leaks
- [medium · agent] WordPress: check the plugin with a caching plugin, a page builder and a block theme → no broken pages; front-end assets load only where needed
- [medium · agent] Shopify: install on a development store, uninstall and reinstall → data cleaned or kept per the policy; webhooks re-registered; billing is test-mode only
- [medium · agent] Shopify: check embedded app behaviour in the admin iframe (App Bridge), on mobile admin width, and with a store in another language and currency → loads; no broken redirects

## Gates

Marketplace review is human: VS Code Marketplace and Open VSX are in `../gates/vscode-marketplace.md`; for JetBrains, AppSource, Figma Community, WordPress.org and Shopify use the sources below and the client's checklist. Block release on:

- Compatibility tool errors (Plugin Verifier, Plugin Check, manifest validation, VS Code tests on the minimum version).
- Activation that blocks the host's startup or uses `*` without a reason.
- Upgrade that loses user data.
- Credentials stored in plain text, or undisclosed network traffic.
- WordPress: missing capability, nonce or escaping checks. Shopify: unverified webhooks or unused scopes.

## Human-only checks

- [human] Use the plugin in your real daily workflow for 30 minutes on a copy of a real project or site → is it faster than without it? Does it ever get in the way?
- [human] Run it in the real Office desktop apps, Figma desktop and JetBrains IDE you ship for → works and looks native.
- [human] Test remote cases that need your accounts (Codespaces, SSH hosts, a production-like WordPress host) → behaves.
- [human] Submit to the marketplace with your own publisher account and answer its forms → accepted. (Agents never submit.)
- [human] Judge the listing copy, icon and screenshots → accurate and not misleading.

## Known pitfalls

- **Slow first activation in the test host** is often the one-time download or extension host spin-up, not the plugin. Measure after warm-up.
- **VS Code deprecation notices in the extension host log** from other extensions aren't this plugin's.
- **`@vscode/test-electron` needs a display** on Linux (use Xvfb); a failing launch there is a setup issue.
- **JetBrains Plugin Verifier "experimental API" warnings** are not failures; "internal" and "removed" usages are.
- **Plugin Check findings come in classes.** Errors block the WordPress.org review; warnings are advice. Don't file every warning as a bug.
- **WP_DEBUG notices from the theme or other plugins** are not the plugin's. Reproduce with only this plugin active on a default theme.
- **Shopify dev-store limits** (password-protected storefront, fake data, test billing) are not bugs.
- **Figma runs plugins in a sandbox**, so some browser APIs are missing by design.
- **Office desktop versus web differences** are common; check the requirement-set support table before filing.

## Sources

1. [VS Code: testing extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension) — `@vscode/test-electron`, `runTests`, `launchArgs`, `--disable-extensions`, `--profile-temp` (checked 2026-11-16)
2. [VS Code: Remote Development and Codespaces (extension author guide)](https://code.visualstudio.com/api/advanced-topics/remote-extensions) — workspace and UI extension kinds in remote windows (checked 2026-11-16)
3. [JetBrains: IntelliJ Plugin Verifier](https://github.com/JetBrains/intellij-plugin-verifier) — checks plugin compatibility against IDE versions (checked 2026-11-16)
4. [Microsoft: Office Add-ins, validate and debug](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/test-debug-office-add-ins) — manifest validation, sideloading (checked 2026-11-16)
5. [Figma: plugin API docs](https://www.figma.com/plugin-docs/) — manifest, running and publishing plugins (checked 2026-11-16)
6. [WordPress.org: Plugin Check](https://wordpress.org/plugins/plugin-check/) — automated checks against plugin guidelines (checked 2026-11-16)
7. [Shopify: app requirements checklist](https://shopify.dev/docs/apps/launch/app-requirements-checklist) — review basics (checked 2026-11-16)
