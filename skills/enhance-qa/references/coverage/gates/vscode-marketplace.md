---
module: vscode-marketplace
kind: gate
title: VS Code Marketplace and Open VSX
checked: 2026-11-16
---
# VS Code Marketplace and Open VSX

Pre-checks for publishing a VS Code extension to the Visual Studio Marketplace (with `vsce`) and to Open VSX (with `ovsx`, used by VSCodium, Cursor-style forks and others). Agents package and inspect. Publishing is a human step: it needs the publisher's token or federated identity, which agents never hold. Use with `../platforms/host-app-plugins.md`, `../features/security.md` and `package-publishing.md`.

## Signals

- A `package.json` with `engines.vscode`, `contributes`, `activationEvents` or `main`; `@vscode/vsce` or `ovsx` in devDependencies; `.vscodeignore`; a `.vsix` in CI artifacts.
- The plan names "Marketplace", "vsce", "Open VSX" or "publish the extension".

## Kickoff questions

1. Publish to the Marketplace, Open VSX or both? (best guess: both)
2. Is there a publisher already and is it verified? (best guess: ask; verification needs a domain and six months of history)

## Drivers

1. **`vsce package` and inspection.** `npx @vscode/vsce package`, `vsce ls` to list files, unzip the `.vsix` and read `extension.vsixmanifest`. Exact and cheap.
2. **Extension Development Host / `@vscode/test-electron`.** Install the `.vsix` in a clean VS Code profile (`--user-data-dir`, `--extensions-dir`) and run the extension tests. Real VS Code is needed; headless needs a display or `xvfb` on Linux.
3. **`code --install-extension file.vsix --force`** on a clean profile, then `code --list-extensions --show-versions`.
4. **Marketplace and Open VSX pages.** Publisher login needed. Agents never type tokens; the user publishes.

**Can't be driven here:** the publisher portals, token or federated identity setup, DNS verification, and marketplace malware scanning. These are human or gate checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | package and manifest checks |
| full | check, plus install in clean profiles on the oldest and newest supported VS Code |
| release | full, plus the listing and human publish steps |

Dimensions: oldest supported and latest VS Code (the `engines.vscode` range), Windows, macOS, Linux, platform-specific `.vsix` targets, remote (SSH, WSL, Dev Containers) and web (vscode.dev).

## Check catalogue

### Manifest
- [high · auto] `package.json` has `publisher`, `name`, `version`, and `engines.vscode` → all present; `vsce package` doesn't error (see Sources 1) {smoke}
- [high · auto] `engines.vscode` is a range the extension truly supports, and `@types/vscode` isn't newer than it → install on the oldest version in the range works; vsce checks the types match
- [medium · auto] Extension name is unique and has no marketplace trademark problem, display name and categories are set, keywords are at most 30 → listing fields valid (see Sources 1)
- [medium · auto] `repository`, `bugs` and `homepage` URLs, and `license` or `LICENSE` file, are set and real → links return 200
- [medium · auto] Version is higher than the published one; pre-release versions use plain major.minor.patch with `--pre-release`, not semver tags → vsce accepts it (see Sources 1)
- [medium · auto] Every `contributes` command, setting, view and keybinding has a title and works; `activationEvents` are as narrow as they can be and not `*` without need → the extension doesn't start on every launch
- [medium · agent] Measure startup: the extension's activation time in the Running Extensions view → activation is quick, with no long blocking work on startup

### Package contents
- [high · auto] `vsce ls` (or unzip) → contains the compiled `main`, `package.json`, README, CHANGELOG, LICENSE and icon; doesn't contain `src/`, tests, `.git`, `node_modules` of dev tools or source maps you don't want published {smoke}
- [high · auto] `.vscodeignore` exists and excludes sources, tests, configs and large files; production dependencies are bundled (esbuild or webpack) or included on purpose → package is small
- [high · auto] Search the `.vsix` contents for `.env`, keys, tokens, `.npmrc`, `.pem` and credentials, including in bundled output → none {security}
- [medium · auto] Package size → within what the team accepted; large assets are downloaded on demand, not bundled (the marketplace has size limits; check the current ones)
- [medium · auto] Dependencies: run `npm audit --omit=dev` and a licence check → no known high-severity vulnerabilities in what ships, and licences allowed {security}

### README, CHANGELOG and icon
- [high · auto] Icon is a PNG at least 128×128 px, not an SVG → vsce accepts it (see Sources 1)
- [high · auto] README and CHANGELOG images use HTTPS URLs and no SVG, except from trusted badge providers → vsce doesn't refuse the package (see Sources 1)
- [medium · agent] README states what the extension does, how to install and use it, the settings and the commands, with screenshots that match the current UI → accurate, no placeholder text
- [medium · agent] README links resolve; relative image links work because `repository` is set → no broken images on the listing
- [low · agent] CHANGELOG has an entry for this version → present
- [medium · agent] If the extension collects telemetry, README and settings say so and honour VS Code's telemetry setting → no telemetry when the user turned it off {security}

### Functional runs
- [high · agent] Install the `.vsix` in a clean profile and run the main command on a sample workspace → works, no errors in the Extension Host log {smoke}
- [high · agent] Run the extension's own tests with `@vscode/test-electron` on the oldest and newest supported VS Code → pass
- [medium · agent] Open a workspace with no folder, a multi-root workspace and an untrusted folder (Workspace Trust) → declared `capabilities.untrustedWorkspaces` behaviour is right
- [medium · agent] Remote and web: run in WSL or SSH remote, and vscode.dev if `browser` is declared → works, or the manifest says it doesn't
- [medium · agent] Uninstall and reinstall → settings remain as the user left them; no leftover processes

### Publishing and Open VSX
- [high · human] Publisher exists on the Marketplace, with the right ID (it can't be changed) and display name → matches the plan (see Sources 1)
- [high · human] Authentication: use the current supported method, since global personal access tokens are retiring from 1 December 2026 and federated identity (GitHub Actions trusted publishing or Azure Pipelines with Entra ID) is recommended → publish job uses it, with no long-lived token in the repo (see Sources 1) {security}
- [medium · human] Verified publisher badge, if wanted: needs an extension on the Marketplace for at least six months and a domain registered at least six months, proven by a DNS TXT record → badge shown (see Sources 1)
- [high · gate] `vsce publish` for the Marketplace → the extension page shows the new version after validation; human only
- [high · gate] `ovsx publish` for Open VSX with a namespace and token → page appears on open-vsx.org; human only (see Sources 2)
- [medium · agent] Install the published version in a clean profile from each registry → it installs and the version matches

## Gates

The package lists only intended files, contains no secrets, the manifest is valid for the declared engine range, README and icon meet vsce's rules, and the human holds the publishing identity.

## Human-only checks

- [human] Create the publisher, set up federated identity or a token, and publish. Agents never type or store tokens.
- [human] Read the Marketplace listing page after publishing. Judge: the text, images and links look right.
- [human] Verify the publisher domain by DNS, if wanted.

## Known pitfalls

- `vsce` refuses user-provided SVGs in the README and an SVG icon. This is a real rule, not a bug.
- A missing `repository` field makes relative README images break on the listing.
- A pre-release version must differ from the release version and can't use semver pre-release tags.
- Marketplace policy and token rules change. Re-read the official page.
- Open VSX is a separate registry with its own namespace, token and review; a pass on one doesn't prove the other.
- Don't compare headless runs with real UI behaviour for webviews.

## Sources

1. [Publishing Extensions (VS Code docs)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) — vsce, publisher, `engines.vscode`, PAT retirement on 1 December 2026, federated identity, verified publishers, pre-release, `.vscodeignore`, icon and SVG rules (checked 2026-11-16)
2. [Open VSX: publishing extensions](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions) — `ovsx`, namespaces, tokens (not re-fetched this pass)
