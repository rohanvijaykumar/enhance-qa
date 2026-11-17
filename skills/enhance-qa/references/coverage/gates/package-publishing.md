---
module: package-publishing
kind: gate
title: Package publishing (npm, PyPI, crates.io, Homebrew, winget)
checked: 2026-11-16
---
# Package publishing (npm, PyPI, crates.io, Homebrew, winget)

Pre-publish checks for libraries, CLIs and tools that ship through a package registry. Publishing is irreversible or hard to undo (versions can usually not be reused), so the publish command itself is always a human step. Agents run the dry runs and inspect the result. Use with `../platforms/libraries-sdks.md`, `../platforms/cli-devtools.md`, `../features/security.md` and `../features/installers-updaters.md`.

## Signals

- `package.json` without `"private": true`, `pyproject.toml` or `setup.py`, `Cargo.toml`, a Homebrew formula or cask, or winget manifests.
- A release workflow with `npm publish`, `twine upload`, `cargo publish`, `pypa/gh-action-pypi-publish`, or `wingetcreate`.
- The plan names "publish" or "release to npm/PyPI/crates".

## Kickoff questions

1. Which registries? (best guess: read the manifests and release workflow)
2. Is this a first publish (name and ownership matter) or an update? (best guess: check the registry read-only)

## Drivers

1. **Dry runs and linters.** `npm pack --dry-run`, `twine check`, `cargo publish --dry-run`, `brew audit --strict`, `winget validate`. Exact; run in a clean checkout.
2. **Install the built artifact in a clean directory or container.** Install the tarball or wheel (never the source tree) into a fresh project, then import or run it. Cheap and the best proof the package works.
3. **Registry read-only lookups.** `npm view`, `pip index versions`, `cargo search` to see names and versions. No writes.
4. **Registry accounts.** Need the user's login or a trusted-publishing setup. Agents never type tokens or OTP codes.

**Can't be driven here:** the publish itself, 2FA codes, registry ownership, Homebrew and winget pull-request review. These are human or gate checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | dry run and file list |
| full | check, plus install from the artifact on each supported OS and runtime version |
| release | full, plus the human publish and a post-publish install |

Dimensions: runtime versions (Node LTS lines, Python versions, Rust MSRV), OS (Windows, macOS, Linux), architecture, install method.

## Check catalogue

### Shared checks
- [high · auto] Build the release artifact from a clean checkout of the release tag → build succeeds; the version in the artifact equals the tag {smoke}
- [high · auto] Install the built artifact into an empty project or container and run the README quick start → it works exactly as documented
- [high · auto] Search the artifact for secrets, `.env`, tokens, private keys and internal URLs → none {security}
- [high · auto] File list contains the code, README, LICENSE and types or typings, and not tests, CI files, editor files or large fixtures → list matches intent
- [medium · auto] Version is new, follows semver, and the changelog has an entry; breaking changes bump the major → registry won't reject it as already published
- [medium · auto] License is declared in metadata and in a file, and dependencies' licences are compatible → present
- [medium · agent] README renders on the registry page (links, images, code blocks) → read the rendered preview or `twine check` output
- [high · auto] Run the project's own tests against the installed artifact, not only the source → pass
- [medium · auto] Dependency audit (`npm audit --omit=dev`, `pip-audit`, `cargo audit`) → no known high-severity issue in shipped dependencies {security}

### npm
- [high · auto] `npm pack --dry-run` lists exactly the intended files; the `files` field or `.npmignore` is set → no `src` or secrets unless wanted (see Sources 1)
- [high · auto] `main`, `exports`, `types`, `bin` and `module` point to files that exist in the tarball → `node -e "require('pkg')"` and an ESM import both work after installing the tarball
- [medium · auto] `engines.node`, `repository`, `bugs`, `homepage` and `keywords` set → fields valid
- [medium · auto] Provenance: publish from CI with `--provenance` (trusted publishing) so the package links to its source build → the npm page shows the provenance badge; needs a supported CI (see Sources 1)
- [high · human] 2FA is on the publishing account, and tokens are granular or trusted publishing is used → no long-lived all-powerful token in CI {security}
- [medium · auto] Scoped package access (`--access public` for a first public scoped publish) and `publishConfig` right → published as intended
- [medium · human] Deprecate bad versions with `npm deprecate pkg@version "message"` rather than trying to delete them → deprecation message shows on install; unpublish has strict limits

### PyPI
- [high · auto] `python -m build` makes an sdist and a wheel; then `twine check dist/*` → both pass with no warnings (see Sources 2)
- [high · auto] Install the wheel and the sdist in separate clean virtual environments → both import and run; the sdist builds from scratch
- [medium · auto] Metadata in `pyproject.toml`: name, version, `requires-python`, classifiers, license, readme, URLs, dependencies with sensible bounds → `twine check` and `pip install` show them right
- [medium · agent] Upload to TestPyPI first and install from it → works (a rehearsal; not real PyPI)
- [high · human] Publish with trusted publishing (OpenID Connect from GitHub Actions or another supported CI) instead of a long-lived token → no API token stored in secrets (see Sources 3) {security}
- [medium · auto] Files can't be re-uploaded with the same name; yanking is the fix for a bad release → plan notes yank, not delete

### crates.io
- [high · auto] `cargo publish --dry-run` → passes; packaging includes the right files (`cargo package --list`) (see Sources 4)
- [medium · auto] `Cargo.toml` has `description`, `license` or `license-file`, `repository`, `readme`, and `rust-version` if relevant → publish isn't rejected for missing metadata
- [medium · auto] Path and git dependencies are replaced by registry versions → none left
- [medium · human] `cargo yank` is the fix for a bad release; yanking doesn't delete the version → noted
- [medium · auto] `cargo test` on the packaged crate (`cargo package` then build from `target/package`) → passes

### Homebrew
- [high · auto] `brew audit --strict --new --online <formula or cask>` → no errors or style offences (see Sources 5)
- [high · auto] `brew install --build-from-source <formula>` then `brew test <formula>` → install succeeds and the formula's `test do` block passes
- [medium · auto] Source URL and `sha256` match the release artifact; casks point to a signed and notarised app on macOS; see `macos-notarization.md` → hash equal; the app opens
- [medium · human] Pull request to homebrew-core or a tap is reviewed by maintainers → merged; human only

### winget
- [high · auto] `winget validate --manifest <folder>` → "Manifest validation succeeded" (see Sources 6)
- [medium · auto] Installer URL, SHA-256 hash, installer type and silent switches are right; installer is signed; see `windows-code-signing.md` → hash matches the file
- [medium · agent] `winget install --manifest <folder>` in a clean VM with local manifest settings enabled by the user, then uninstall → installs silently and uninstalls
- [medium · human] Submit through `wingetcreate` or a pull request to the community repository and pass the pipeline checks → merged; human only

### Publish and post-publish
- [high · gate] Human runs the publish with 2FA or trusted publishing → registry shows the new version
- [high · agent] From a clean machine, install the published version by its real name and run the quick start → works; version matches
- [medium · agent] Check the registry page: README, links, license, version and provenance → correct

## Gates

Dry runs pass, the artifact installs and runs from a clean environment, no secrets ship, the version and changelog are right, and a human performs the publish with 2FA or trusted publishing.

## Human-only checks

- [human] Sign in to the registry, complete 2FA and publish. Agents never type tokens, passwords or OTP codes.
- [human] Check the package name isn't confusable with another and the owner account is yours.
- [human] Read the rendered registry page. Judge: it describes the package honestly.

## Known pitfalls

- A published version can't be reused on npm, PyPI or crates.io. A dry run is the last safe check.
- Registry rules and tool flags change (trusted publishing, provenance, token types). Re-read the official page.
- `npm pack --dry-run` shows what would ship; `.gitignore` is used if there's no `.npmignore` or `files`. Don't assume.
- A source tree that works can still fail from the package; always test the artifact.
- `brew audit` style warnings on cask or formula are the maintainers' rules; don't treat them as product bugs.
- Don't publish to the real registry during tests. Use TestPyPI or a local registry (Verdaccio) for rehearsals, never real names.

## Sources

1. [npm docs: generating provenance statements](https://docs.npmjs.com/generating-provenance-statements) and `npm pack` / `files` field docs (not re-fetched this pass)
2. [Python Packaging User Guide](https://packaging.python.org/) — build, `twine check`, metadata (not re-fetched this pass)
3. [PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/) — OIDC publishing (not re-fetched this pass)
4. [The Cargo Book: publishing](https://doc.rust-lang.org/cargo/reference/publishing.html) — metadata and dry run (not re-fetched this pass)
5. [Homebrew docs: Acceptable Formulae and audit](https://docs.brew.sh/Acceptable-Formulae) — formula and cask rules (not re-fetched this pass)
6. [winget manifest documentation](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest) — manifest and `winget validate` (not re-fetched this pass)
