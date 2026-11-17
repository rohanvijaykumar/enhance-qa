---
module: libraries-sdks
kind: platform
title: Libraries and SDKs (npm, PyPI, crates, NuGet, Maven/Gradle)
checked: 2026-11-16
---
# Libraries and SDKs

Covers code that other developers install and call: packages on npm, PyPI, crates.io, NuGet, Maven Central and Gradle plugins, plus vendor SDKs wrapping an API. The "user" is a developer, so the product is the install, the public API, the docs examples, the types and the package contents. It doesn't cover the service behind an SDK (use `apis-backend.md`) or command-line tools (use `cli-devtools.md`). It goes with `../features/security.md` and, for release, `../gates/package-publishing.md`.

## Signals

- `package.json` with `main`, `module`, `exports`, `types` or `files`, and no `private: true`; a `tsup`, `rollup`, `vite` library mode or `tsc` build.
- `pyproject.toml` or `setup.py` with a build backend (hatchling, setuptools, poetry, maturin); a `src/<pkg>/` layout.
- `Cargo.toml` with `[lib]` and no `[[bin]]` only; `*.csproj` with `PackageId` or `GeneratePackageOnBuild`; `pom.xml` or `build.gradle` with `maven-publish`.
- README words: "install with", "npm install", "pip install", "cargo add", "API reference", "SDK", "client library".
- A `CHANGELOG.md`, `.changeset/`, `release-please` or `semantic-release` config.

## Kickoff questions

1. Which ecosystems and which runtime versions must it support? (best guess: read `engines`, `requires-python`, `rust-version`, `TargetFrameworks` and the CI matrix)
2. Is it already published, and if so what is the last released version users have? (best guess: yes if there is a git tag or registry page; compare against that version for semver checks)
3. Does it call a hosted API? If so, is there a sandbox or test key, or only production? (best guess: no sandbox, so network calls are mocked or skipped)

## Drivers

1. **The project's own tests, linter and type checker.** Run first and record as the baseline. Then run them against the built package, not only against `src/`.
2. **Pack, then install the tarball in a clean place.** `npm pack` and `npm install ./pkg.tgz` in an empty folder; `python -m build` and `pip install dist/*.whl` in a fresh venv; `cargo package` then `cargo publish --dry-run`; `dotnet pack` and a new project referencing the `.nupkg` from a local feed; `mvn install` or `./gradlew publishToMavenLocal` then a tiny consumer project. Use a container (Docker) for a truly clean machine where available. Never publish to the real registry to test.
3. **Docs-example runner.** Extract every fenced code block from the README and docs, put each in a scratch project that depends on the packed artefact, and run it. Doctest or `cargo test --doc` where the language has it. Observe exit code and output only.
4. **Package-content and type validators.** `npm pack --dry-run` (file list and size), `publint`, `@arethetypeswrong/cli` (`attw`), `twine check`, `check-wheel-contents`, `cargo package --list`, `dotnet nuget verify`, `nuget` package explorer output. These are deterministic oracles.
5. **API surface diffing.** Compare public exports between the last release and the candidate: `api-extractor` or `tsc --declaration` output diff (TypeScript), `griffe check` (Python), `cargo semver-checks`, `japicmp` (Java), `Microsoft.CodeAnalysis.PublicApiAnalyzers` or `ApiCompat` (.NET).
6. **Version matrix runners.** `tox` or `nox`, `nvm`/`fnm` plus `npm test`, GitHub Actions matrix, `cargo +<toolchain>`, Docker images per runtime. Run only the supported ends and the middle, not every version.
7. **Audit and licence tools.** `npm audit`, `pip-audit`, `cargo audit`, `cargo deny`, `license-checker`, `pip-licenses`, `dotnet list package --vulnerable`.

**Can't be driven here:** the real registry's upload, provenance and trusted-publishing steps, two-factor prompts and token creation (human or gate). Platforms the dev machine doesn't have (macOS-only or ARM-only native add-ons) become CI or device checks. Behaviour against a production API that needs a paid key is a human check.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | clean install of the packed artefact on the newest supported runtime, import it, run the README quick-start |
| check | smoke cell, plus the cells for changed exports, plus the API diff against the last release |
| full | pairwise over runtime version × module system × OS × package manager |
| release | oldest, newest and one middle runtime on each OS, ESM and CJS, a clean container install, plus the human checks |

Dimensions: runtime versions (oldest and newest supported); OS and architecture; module system (ESM, CJS, bundler, no bundler); package manager (npm, pnpm, yarn, pip, uv, poetry); TypeScript strictness and `moduleResolution`; frameworks the SDK integrates with; dependency resolution (lowest and latest allowed versions).

## Check catalogue

### Install and packaging
- [high · auto] Pack the library and install the artefact in an empty directory on a clean container → install succeeds with no peer-dependency, build-script or compiler errors {smoke}
- [high · auto] Import or require the package from the installed copy and call one public function → returns the documented result; no missing-module error {smoke}
- [high · auto] List the contents of the artefact (`npm pack --dry-run`, `cargo package --list`, `unzip -l` on the wheel or nupkg) → contains the built output, README, LICENSE and types; no `.env`, keys, `node_modules`, test fixtures, source maps you didn't intend, editor folders or files over a few MB {security}
- [high · auto] Search the artefact for secrets and internal URLs (`gitleaks` or `trufflehog` on the unpacked tree, grep for `localhost`, `staging`, `internal`) → none found {security}
- [medium · auto] Check `package.json` `exports`, `main`, `module`, `types` and `bin` (or the `pyproject` entry points, `[lib]` paths) → every path points to a file that exists in the artefact
- [medium · auto] Run `publint` and `attw` (npm), `twine check` (PyPI), `cargo publish --dry-run`, `dotnet pack` warnings → no errors; warnings triaged
- [medium · auto] Install with each supported package manager (npm, pnpm, yarn, or pip, uv, poetry) → same working result; lockfile resolution doesn't pull a broken transitive version
- [medium · auto] Install with `--ignore-scripts` (npm) or from a wheel with no compiler present → works if the docs say it should; if native build is needed, the error says which toolchain is missing
- [medium · auto] Install on the oldest and newest supported runtime → both work; the unsupported ones fail with a clear engine or `requires-python` message, not a cryptic syntax error
- [medium · auto] Check declared dependencies against actual imports (`depcheck`, `deptry`, `cargo udeps`) → no import of an undeclared package; no unused heavy dependency
- [low · auto] Check install size and dependency count against the claim in the README (if any) → matches, or the claim is updated
- [medium · auto] Check the licence field, `LICENSE` file and the licences of dependencies → they agree; no copyleft or unknown licence in the dependency tree that conflicts with the declared one

### Docs examples and public API
- [high · auto] Run every code block in the README and docs against the packed artefact → each runs without edits, or is clearly marked as a fragment; output matches what the docs show {smoke}
- [high · agent] Follow the quick-start as a new developer in an empty project, copying commands exactly → reaches the first working result in the stated time with no undocumented step
- [high · auto] Compare the exported public API with the API reference → every documented function, class, option and default exists with that name and signature; nothing exported that is undocumented and not marked internal
- [medium · auto] Check each documented default and each documented error → the default value and the error type or message match
- [medium · agent] Call each public function with wrong types, `null`/`None`, empty collections and huge input → a clear typed error, never a hang, a crash of the host process, or silent wrong output
- [medium · agent] Call async APIs with a cancelled signal, a timeout and a rejected callback → cancellation and timeout work; no unhandled promise rejection or leaked task
- [medium · agent] Use the library from two instances or threads at once, and call `close` or `dispose` twice → no shared-state corruption; shutdown is idempotent
- [medium · agent] Check that the package has no side effects on import (network calls, files written, global patches, console output) → nothing happens until a function is called; tree-shakers can drop unused parts
- [medium · agent] Check logging and telemetry → silent by default or opt-in; no secrets or full request bodies logged; any telemetry is disclosed in the README
- [low · agent] Check example apps and templates in `examples/` → they install and run against the current version

### Versions, semver and compatibility
- [high · auto] Diff the public API against the last released version → every removed or changed signature is in a major bump, or listed as a documented breaking change {smoke}
- [high · auto] Compare the version in the manifest, the git tag, the changelog entry and any `__version__` constant → all agree
- [medium · auto] Check behavioural changes the API diff can't see (default values, error types, ordering, rounding) with the old release's tests run against the new build → differences are intentional and in the changelog
- [medium · agent] Check that new deprecations emit one clear warning with the replacement named and the removal version, and that the warning appears once, not per call → matches
- [medium · auto] Resolve dependencies at the lowest allowed versions (`pip install --resolution lowest-direct`, `npm install` with pinned minimums, `cargo -Z minimal-versions`) and run tests → they pass, so the declared ranges are honest
- [medium · auto] Resolve at the newest allowed versions of dependencies and peers → tests pass; a new major of a peer is either excluded or tested
- [medium · agent] Check the pre-release or `next` tag convention → pre-releases don't become `latest` or satisfy ordinary ranges by accident
- [medium · agent] Check the upgrade path from the last release: install old, write data or config, upgrade, run → migration works or the changelog says what to change

### Types, modules and bundling
- [high · auto] Compile a strict TypeScript consumer (`strict: true`, `moduleResolution` set to `node16`, `bundler` and `node10`) against the packed types → no errors, and `attw` reports no resolution problems {smoke}
- [high · auto] Import from both ESM and CJS (`import` and `require`), and from a bundler build (Vite, webpack, esbuild) → each gets the right file; no "dual package hazard" where two copies load, and no `ERR_REQUIRE_ESM`
- [medium · auto] Bundle a tiny app that imports one function and measure the output → unused exports are dropped (`sideEffects` is correct); size is in line with the claim
- [medium · auto] Run `mypy --strict` or `pyright` on a consumer, and check `py.typed` is shipped (Python) → types resolve; no `Any` leaking from public signatures that the docs call typed
- [medium · agent] Check the types in an editor-like check (`tsc --noEmit` or `tsserver` hover output) for the main API → parameters and returns are specific, JSDoc or docstrings carry through, generics infer
- [low · auto] Check browser and edge-runtime use (Deno, Bun, Cloudflare Workers, React Native) if the README claims it → the claimed runtimes import and run the quick-start; unclaimed ones fail or are listed as unsupported
- [medium · auto] Check native add-ons and wheels (prebuilt binaries per OS, architecture and libc) → each claimed platform installs without a compiler; missing platforms are documented

### Security and supply chain
- [high · auto] Run the ecosystem audit (`npm audit`, `pip-audit`, `cargo audit`, `dotnet list package --vulnerable`, OWASP dependency-check) → no known high or critical issue in shipped dependencies, or each is triaged {security}
- [medium · auto] Check install scripts (`preinstall`, `postinstall`, `setup.py` hooks, `build.rs`) → none download or run code from the network; any script is documented {security}
- [medium · agent] Check the SDK handling of credentials: keys in constructor, env var and config → never logged, never put in URLs, redacted in error output and debug dumps {security}
- [medium · agent] Check TLS, redirects and retries in SDK network calls → certificate validation on by default; retries only for idempotent calls or with an idempotency key; backoff with a cap; a redirect doesn't forward the auth header to another host {security}
- [medium · agent] Feed hostile input to parsers and deserialisers (deeply nested, huge, malformed, path traversal in file names) → bounded time and memory; no code execution; clean error
- [low · auto] Check that the repo and package have a security policy and a way to report issues → `SECURITY.md` or the registry field exists and the contact works

### Changelog, docs and metadata
- [medium · agent] Compare the changelog entry with the actual diff (`git log` since the last tag) → every user-visible change is listed; nothing listed that isn't there; breaking changes are marked
- [medium · auto] Check registry metadata (description, keywords, repository, homepage, bugs URL, licence, `engines`, classifiers) → present and links resolve
- [medium · auto] Check links in the README, docs and package metadata → no dead links; badges point to the right package and branch
- [low · agent] Read the generated API docs (TypeDoc, Sphinx, rustdoc, DocFX, Javadoc) → build without warnings, every public item has a description, examples compile
- [low · auto] Check README renders on the registry page (the long-description renderer, not GitHub) → no raw markup, broken images or relative links

### Behaviour of SDKs that wrap an API
- [high · auto] Run the SDK against a mock or recorded server (VCR-style cassettes, `msw`, WireMock) for every endpoint wrapper → request path, method, headers and body match the API reference; response parsing returns typed objects
- [medium · auto] Mock error responses (400, 401, 403, 404, 409, 422, 429 with `Retry-After`, 500, 503, timeouts, truncated body) → the SDK raises the documented error types; 429 backs off; no infinite retry loop
- [medium · auto] Mock pagination (empty, one page, many pages, a changing list) → iterators stop correctly; no duplicates or skipped items
- [medium · agent] Check the SDK against the API's own spec (OpenAPI diff) → no endpoints, fields or enum values missing; unknown new enum values don't crash parsing
- [medium · agent] Check streaming, file upload and download, and webhooks verification helpers if offered → they work on large files and handle disconnects; signature checks reject tampered payloads

## Gates

Publishing to a registry is a human step: see `../gates/package-publishing.md`. Block release when any of these fail:

- The clean-install check or any README example fails on a supported runtime.
- The API diff shows a breaking change in a minor or patch bump.
- The artefact contains secrets, credentials or files that should not ship.
- Types don't resolve for a strict consumer, or ESM or CJS import fails.
- A high or critical known vulnerability in shipped dependencies with no triage.
- The licence is missing or conflicts with a dependency.

## Human-only checks

- [human] Read the README top to bottom as a developer who has never seen the project → can you decide in two minutes what it does, install it and see it work? Is anything missing or misleading?
- [human] Judge the API's naming, consistency and error messages by writing a small real program with it → does it feel predictable, and do errors tell you what to do?
- [human] Publishing: create the registry account, token and two-factor setup, and run the real publish yourself → a published version appears and installs. (Agents never publish.)
- [human] Review the changelog wording and the deprecation notices → clear to a user who didn't follow development.
- [human] Check the licence choice and any third-party notices with whoever owns the legal decision.

## Known pitfalls

- **Testing `src/` instead of the artefact.** Tests pass from the source tree and the package still breaks because a file wasn't listed in `files`, `MANIFEST.in` or `include`. Always install the packed artefact.
- **Local linking hides problems.** `npm link`, editable installs (`pip install -e`) and workspace references skip the packing step. Don't use them as install evidence.
- **Peer-dependency warnings aren't always bugs.** npm 7 and later installs peers automatically; only report when the install fails or a runtime error follows.
- **Deprecation warnings from your own dependencies** (Node `punycode`, `DEP0040`, Python `DeprecationWarning` from a transitive package) are noise unless the library itself triggers them in the user's code.
- **Dev dependencies in the lockfile** are not shipped. Don't report vulnerabilities in dev-only trees as user-facing, though note them.
- **Semver is a convention, not a law.** A pre-1.0 version (`0.x`) may legitimately break in minors; check what the project claims. Report the mismatch with its own claim, not with a general rule.
- **Bundle size numbers vary** by bundler, minifier and compression. Compare against the previous release under the same tool, not against a vendor claim.
- **Registry caching.** A just-published version can take minutes to appear, and a yanked version may still resolve from caches; retry before reporting.
- **Examples needing a real API key** shouldn't be run with a production key. Mock them or mark them human.

## Sources

1. [Semantic Versioning 2.0.0](https://semver.org/) — what counts as a breaking change and how 0.x versions behave (checked 2026-11-16)
2. [npm docs: npm pack and package.json fields](https://docs.npmjs.com/cli/commands/npm-pack) — packing, `files`, `exports`, `engines` (checked 2026-11-16)
3. [publint](https://publint.dev/) — package export and metadata linting (checked 2026-11-16)
4. [Are the types wrong?](https://arethetypeswrong.github.io/) — checks type resolution for ESM, CJS and bundlers (checked 2026-11-16)
5. [Python Packaging User Guide](https://packaging.python.org/) — building, wheels, `twine check`, metadata (checked 2026-11-16)
6. [cargo-semver-checks](https://github.com/obi1kenobi/cargo-semver-checks) — semver lint for Rust crates (checked 2026-11-16)
7. [The Cargo Book: publishing](https://doc.rust-lang.org/cargo/reference/publishing.html) — `cargo package` and `cargo publish --dry-run` (checked 2026-11-16)
8. [NuGet docs: creating and publishing packages](https://learn.microsoft.com/en-us/nuget/create-packages/overview-and-workflow) — `dotnet pack`, package verification (checked 2026-11-16)
9. [Maven Central requirements](https://central.sonatype.org/publish/requirements/) — what a Maven artefact must contain (checked 2026-11-16)
10. [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/) — known-vulnerability scanning for dependencies (checked 2026-11-16)
