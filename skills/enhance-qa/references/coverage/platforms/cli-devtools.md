---
module: cli-devtools
kind: platform
title: Command-line tools and developer tools
checked: 2026-11-16
---
# Command-line tools and developer tools

Covers command-line programs and developer tools: commands and flags, exit codes, stdin, stdout and stderr, pipes, TTY vs non-TTY, colour, shells, paths, line endings, install methods, `--help` and `--version`, config files and environment variables. It also fits dev tools with a command-line front end (linters, generators, build tools, git helpers). It doesn't cover libraries (use `libraries-sdks.md`) or package publishing (use `../gates/package-publishing.md`). It goes with `../features/installers-updaters.md`, `../features/settings-persistence.md` and `../features/security.md`.

## Signals

- `package.json` with a `bin` field; `pyproject.toml` with `[project.scripts]`; `Cargo.toml` with `[[bin]]`; `go.mod` with a `main` package; `setup.py` with `console_scripts`; a `bin/` folder; `cobra`, `clap`, `click`, `typer`, `commander`, `yargs` or `argparse` in the dependencies.
- A `man/` folder, shell completion scripts, a Homebrew formula, a winget manifest, a `Dockerfile` with an `ENTRYPOINT`.
- README words: "CLI", "command line", "install with npm install -g", "brew install", "usage:".

## Kickoff questions

1. Which OSes and shells must it work on, and how is it installed? (best guess: Windows, macOS and Linux; npm, pip or a binary download)
2. Is it interactive (prompts, a TUI) or script-friendly only, and does it call the network or change files? (best guess: both modes; mutating commands exist)
3. Which commands and flags are the stable interface (the ones users script against)? (best guess: those in the README)

## Drivers

1. **The shell.** An agent is a native CLI user. Run the command, capture stdout, stderr and the exit code separately: `cmd >out.txt 2>err.txt; echo $?` (bash, zsh), `$LASTEXITCODE` (PowerShell), `%ERRORLEVEL%` (cmd). Cheapest and most reliable driver; use it for nearly every check.
2. **A test harness for repeatable cases.** `bats-core` for bash, `pytest` with `subprocess` or `click.testing`, `cram`, `trycmd` (Rust) or `go test` with `exec.Command`. Table-driven cases: arguments, stdin, expected stdout and exit code.
3. **Pseudo-terminals for interactive behaviour.** `script`, `unbuffer`, Python's `pty` or `pexpect`, `expect`, `winpty` or ConPTY on Windows, and `tmux` or `asciinema` for capturing. Use them for prompts, colours as seen on a TTY and TUIs. Run the same command piped to compare non-TTY behaviour.
4. **Clean environments.** `env -i`, a temporary `HOME` and `XDG_CONFIG_HOME`, a temp working folder with and without spaces, Docker images of Ubuntu and Alpine, Windows Sandbox or a VM for installs. Never test against the user's real config or credentials.
5. **Linters for the CLI.** `shellcheck` for shell scripts, `--help` text diffed against the docs, `man -l` on man pages, `completions` generated and sourced in each shell. Install-method checks with `npm pack` (look at the file list), `pipx install`, `brew audit --strict`, `winget validate` [1].
6. **A tool for cost control.** Print short summaries (`| head`, `wc -l`, exit code) instead of dumping long output into the agent's context.

**Can't be driven here:** interactive TUIs are hard to judge from text (layout, cursor, redraw); use a pty capture and a human look. Real terminals differ (Windows Terminal, iTerm2, GNOME Terminal, VS Code terminal); a clipboard, bell or hyperlink feature can't be fully checked headlessly. macOS and Linux install paths need those OSes or containers. Clarity of wording is a human judgement.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | the host OS and shell, installed the documented way into a clean folder, `--version`, `--help`, and the main command |
| check | smoke, plus piped vs TTY, plus the changed commands with success and failure cases |
| full | pairwise over OS (Windows, macOS, Linux) × shell (bash, zsh, fish, PowerShell, cmd) × output (TTY, pipe, file, CI) × locale × install method × architecture |
| release | every install method on every OS from the real package artefact, upgrade and uninstall, human checks of the help text and a TUI |

Dimensions: OS; shell; output target (TTY, pipe, redirect to file, CI without a TTY); stdin (TTY, pipe, closed, empty); working directory (with spaces, non-ASCII, long path, read-only); locale and code page; `NO_COLOR`, `TERM=dumb`; install method (npm, pip, pipx, brew, winget, cargo, go install, binary, Docker); architecture; version of the runtime (Node, Python); with and without network.

## Check catalogue

### Smoke
- [high · auto] Install the documented way into a clean environment, run `tool --version` → exit code 0; prints a version matching the package or release tag {smoke}
- [high · auto] Run `tool --help` and `tool` with no arguments → exit code 0 for `--help`; useful usage text; no stack trace {smoke}
- [high · agent] Run the main command with valid input on a temp folder → expected output and exit code 0; the files or result it should create exist {smoke}
- [high · auto] Run the project's tests and the linter → pass or recorded as baseline {smoke}

### Help, version and discoverability
- [high · auto] `-h`, `--help`, `help`, `help <subcommand>`, and the bare command → each shows usage; help goes to stdout with exit 0 when asked for, to stderr with a non-zero exit on a usage error [2]
- [medium · agent] Compare every command and flag in `--help` with the README and man page → they agree; no documented flag missing, no undocumented flag shown
- [medium · agent] `--version` and `-V`, and the version in `--help`, in the package metadata and in the release tag → one version everywhere
- [medium · agent] Mistype a command (`tool lst`) → "did you mean list?" or a pointer to `--help`; non-zero exit
- [medium · agent] Help text examples → copy and run two or three; they work as written
- [medium · auto] Shell completions (bash, zsh, fish, PowerShell) if shipped → install, source and complete a command and a flag; no errors on load
- [low · auto] Man page → `man ./tool.1` renders; no broken markup; options match

### Exit codes
- [high · auto] Success → 0; every failure kind (bad usage, missing file, no permission, network error, validation failure) → non-zero and, where documented, distinct codes [2]
- [high · auto] Run in a script with `set -e` and `|| echo failed` → failures stop the script; success doesn't print "failed"
- [medium · auto] Exit code on Ctrl-C (130 on Unix by convention) and on SIGTERM → the tool exits promptly with a non-zero code, no stack trace
- [medium · auto] Exit code when the output pipe closes early (`tool | head -1`) → quiet exit without a "broken pipe" traceback
- [medium · agent] Warnings → exit 0 unless a strict flag exists; the documented rule holds
- [medium · agent] Does the tool wrongly return 0 after an internal error, or 1 for all errors? → each documented failure returns its documented code

### Streams, pipes and redirection
- [high · auto] Capture stdout and stderr separately → results and data go to stdout; progress, warnings, prompts and errors go to stderr [2]
- [high · auto] `tool … | jq .` or `| head`, `| wc -l`, `> file` with `--json` or the machine format → valid, parseable output; no log lines or colour codes mixed into stdout
- [high · auto] Read from stdin: `echo data | tool -`, `tool < file`, here-doc, empty stdin, closed stdin (`< /dev/null`) → works with data; clear error on empty or closed stdin; never hangs waiting for input in a non-TTY
- [medium · auto] Large input (100 MB or more) and a long stream through a pipe → constant memory; output starts before input ends where claimed
- [medium · auto] Output to a file that exists, a read-only location, a full disk, `/dev/null`, and the same file as input → clear errors; no truncated input file; asks or refuses before overwriting where claimed
- [medium · auto] Binary and non-UTF-8 input → handled or rejected with a message; no crash
- [medium · auto] Run with output piped on Windows PowerShell 5.1 and PowerShell 7 → encoding is right (PowerShell 5.1 can add a BOM or UTF-16 when redirecting with `>`); no mojibake
- [medium · auto] Line endings: input with CRLF and LF, output on Windows and Unix → handled; no stray `\r` in parsed values; output uses the documented ending
- [low · auto] Progress bars and spinners when piped or in CI → absent (or plain lines); they appear only on a TTY

### TTY vs non-TTY and interactivity
- [high · agent] Run the same command on a TTY and piped → same data; only decoration (colour, progress, prompts) differs [2]
- [high · auto] Prompts in a non-TTY (`< /dev/null`, CI) → no hang; the tool fails with a message naming the flag that supplies the answer (`--yes`, `--no-input`, `--force`)
- [medium · agent] Destructive commands (delete, overwrite, reset) → ask for confirmation on a TTY, offer `--dry-run`, and prompt-skipping flags exist; dry-run changes nothing (check with a file diff)
- [medium · agent] Ctrl-C during a long task and during a prompt → exits quickly, cleans temp files, leaves no half-written output; a second Ctrl-C forces exit
- [medium · agent] Terminal size changes and narrow terminals (40 columns), `COLUMNS` and `LINES` → wrapping and tables stay readable; no crash on zero width
- [medium · agent] TUI (if any): keys, mouse, redraw after resize, quit with `q` and Ctrl-C, terminal restored on exit and after a crash (no raw mode left on) → works; the shell is usable afterwards
- [low · agent] Password and secret prompts → no echo; secrets never accepted as plain command-line flags (they show in process lists and shell history) {security}

### Colour and output formatting
- [high · auto] `NO_COLOR=1`, `TERM=dumb`, `--no-color`, and piped output → no ANSI escape codes [3]
- [medium · agent] Colour on a TTY on dark and light terminals → readable; not colour-only information; error text is distinguishable without colour {a11y}
- [medium · auto] `--json` or `--format` output → valid JSON; stable key names; errors also as JSON where promised; no ANSI inside
- [medium · agent] Unicode output (box drawing, emoji, spinners) on Windows cmd with a legacy code page and on Windows Terminal → renders or falls back to ASCII; no `?` or mojibake
- [low · agent] Hyperlinks, bell and window-title escape sequences → only on a capable TTY

### Arguments, flags and paths
- [high · auto] Short and long flags, `--flag=value` and `--flag value`, `--` to end options, combined shorts (`-abc`), repeated flags, unknown flags, missing values, conflicting flags → documented behaviour; errors say which flag is wrong
- [high · agent] Paths with spaces, quotes, apostrophes, `$`, `&`, parentheses, non-ASCII and emoji characters; in the working folder and as arguments → handled, with correct quoting in the tool's own messages and in generated commands
- [medium · agent] Relative, absolute, `~`, `..`, symlinks, junctions, UNC paths (`\\server\share`), drive letters, case-insensitive file systems → resolved as documented
- [medium · agent] Paths longer than 260 characters on Windows (without long-path support) → works or fails with a clear message
- [medium · agent] Globs and wildcards: shell-expanded (bash, zsh) vs tool-expanded (PowerShell and cmd don't expand `*` for native commands) → the tool behaves the same, or the docs show quoting
- [medium · agent] Quoting differences across bash, zsh, fish, PowerShell and cmd for the README examples (single quotes, double quotes, `$VAR`, `%VAR%`, backslash) → examples work in each shell the README claims, or each shell has its own example
- [medium · agent] Arguments that look like flags (a file named `-rf`), empty string arguments, very long argument lists → handled; `--` is respected
- [medium · agent] Boundary values and numbers in different locales (decimal comma) → parsed as documented; errors clear

### Config files, environment variables and precedence
- [high · agent] Set a value by flag, environment variable, project config, user config and system config → precedence is flags over environment over project over user over system (or the documented order); `--show-config` or verbose output shows the winner [2]
- [medium · agent] Config locations: `XDG_CONFIG_HOME` and `~/.config` on Linux, `%APPDATA%` on Windows, `~/Library/Application Support` or `~/.config` on macOS → files created in the documented place; honours overrides; no clutter in `$HOME`
- [medium · agent] Missing, empty, malformed, unreadable and wrongly-typed config files; unknown keys; a config with comments or a BOM → clear error naming the file and line; no crash
- [medium · agent] Environment variables: unset, empty, unusual values, and secrets in variables → documented behaviour; secrets never printed in logs or `--verbose` output {security}
- [medium · agent] `HOME` unset or read-only, no write access to the config dir, run as root, run in a container → works or fails with a clear message
- [medium · agent] Run the tool twice at once in the same folder (lock files, caches) → one waits or refuses with a message; no corrupt state
- [low · agent] Upgrade with an old config file from the last release → still works; deprecated keys warn

### Install methods and upgrade
- [high · auto] `npm install -g`, `npx`, `pipx install`, `pip install --user`, `brew install`, `winget install`, `cargo install`, `go install`, and a binary download (use the ones the README lists) in a clean environment → each installs, `tool --version` works, no peer-dependency or build errors [1]
- [high · auto] Install and run from a folder or user name with spaces → works; no hard-coded paths
- [high · auto] `npm pack --dry-run` or inspect the wheel and sdist → only intended files are shipped (the `bin` target, runtime files); no tests, secrets, `.env` or large source maps; `bin` has the correct executable bit and shebang (`#!/usr/bin/env node`)
- [medium · auto] Run via a version manager (nvm, volta, pyenv, asdf), in a virtual environment and in Docker → finds its runtime; clear message if the runtime is too old
- [medium · auto] Minimum runtime versions in docs (`engines`, `python_requires`) → install fails clearly on an older runtime; works on the stated minimum
- [high · agent] Upgrade from the previous version and then downgrade → config and data stay compatible; no duplicate binaries on `PATH` (check `which -a tool` or `where tool`)
- [high · agent] Uninstall by the same method → the command is gone from `PATH`; documented leftovers only (config, cache)
- [medium · auto] Binary downloads: checksum and signature are published and verify; macOS binary is signed and notarised or the docs explain `xattr`; Windows binary signed or SmartScreen noted {security}
- [medium · auto] Architecture: x64 and arm64 on macOS, Linux and Windows; musl vs glibc on Alpine → each artefact runs on its target; the install script picks the right one
- [medium · auto] "curl | sh" install scripts → served over HTTPS, read the script first (no `sudo` without asking, no unexpected downloads), idempotent; the script checks failure and doesn't half-install {security}
- [low · auto] Docker image (if offered): runs as non-root, has `--help` as a sane default, works with mounted volumes and file ownership

### Safety and side effects
- [high · agent] Run every mutating command with `--dry-run` or in a throwaway folder first → nothing outside the target is changed (diff the file tree); never run against the user's real project, home folder or accounts
- [high · agent] Commands that delete, overwrite, push, publish, send or pay → require explicit confirmation or flags; tests use fixtures and fake remotes only
- [medium · agent] Network calls: run with no network, a proxy variable (`HTTPS_PROXY`), a slow server and a failing DNS → clear message; timeouts exist; retries are bounded; no telemetry unless documented and disclosed
- [medium · auto] Telemetry and update checks → documented, can be turned off (`DO_NOT_TRACK` or the tool's flag), don't send data in tests {security}
- [medium · agent] Logs and `--verbose` or `--debug` output → no tokens, passwords or personal data; log level flags work {security}
- [medium · agent] Temp files and caches → created in the temp dir, cleaned up after success and after errors; permissions restrictive for secrets

### Performance and robustness
- [medium · auto] Time a no-op (`--version`) and a typical command → start-up is fast (a slow `--version` often means eager imports); record it, compare to the last release
- [medium · auto] Run on 10,000 files, a huge file, deeply nested folders and many small writes → completes in reasonable time and memory; progress shown for long runs
- [medium · agent] Interrupted network or killed mid-write → can resume or leaves a clean state; no corrupted output file
- [low · auto] Unicode normalisation, case-insensitive and long file names on macOS and Windows → no duplicate or lost files

## Gates

- `../gates/package-publishing.md` for npm, PyPI, crates, Homebrew and winget publishing.
- Release blockers specific to CLIs: `--version` or `--help` crashes, wrong exit codes on failure, ANSI codes or logs in piped stdout, a prompt that hangs in CI, a mutating command with no confirmation or dry-run, a broken install on a supported OS, missing or wrong files in the package.

## Human-only checks

- [human] Read `--help` and the first screen of the README as a newcomer → can you complete the main task in five minutes without asking anyone?
- [human] Use the tool in your own real terminal (and a second one, such as Windows Terminal and VS Code's) for the main task → output looks right; colours readable; it feels fast
- [human] Use the TUI (if any) with keyboard and mouse → clear, no flicker, quits cleanly
- [human] Read the error messages for the three most likely mistakes → they say what went wrong and what to do
- [human] Publish a release to a package registry or Homebrew tap → an agent never publishes

## Known pitfalls

- **PowerShell and cmd are not bash.** Quoting, `$VAR` vs `%VAR%`, glob expansion and `echo` redirection encoding differ; a README example that fails in the wrong shell is a docs gap, not a code bug, unless the docs claim that shell.
- **PowerShell 5.1 `>` redirection** writes UTF-16 with a BOM; piping text between native programs may re-encode. Check before filing mojibake [4].
- **`--help` to stderr on usage errors is normal.** Compare with the convention before filing.
- **A TTY-only feature that disappears in a pipe is correct.** Colour, progress and prompts should not appear when piped.
- **Exit code 130 and 143** mean killed by signal (Ctrl-C and SIGTERM); not crashes.
- **Slow first run** can be a cold cache, antivirus scanning, or a JIT; measure the second run.
- **Broken pipe** messages from Python or Node on `| head` are a known pattern, but the tool should handle it quietly; file it as low.
- **Windows path length and case-insensitive file systems** cause problems that Linux runs won't show.
- **Global installs depend on `PATH`.** "command not found" right after `npm i -g` or `pipx install` is often a `PATH` setup issue; check the install docs mention it.
- **Never run against real data, accounts or the user's home config.** Use temp folders, `HOME` overrides and fixtures; never paste real tokens.

## Sources

1. [pipx documentation](https://pipx.pypa.io/stable/) — installing Python CLIs into isolated environments; npm, brew and winget checks use their own official docs: [npm pack](https://docs.npmjs.com/cli/commands/npm-pack), [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook), [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) (checked 2026-11-16)
2. [Command Line Interface Guidelines](https://clig.dev/) — help, exit codes, streams, TTY detection, config precedence, `--dry-run`, Ctrl-C, secrets (checked 2026-11-16)
3. [NO_COLOR](https://no-color.org/) — the convention to disable ANSI colour (checked 2026-11-16)
4. [Microsoft: about_Character_Encoding (PowerShell)](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding) — default encodings in PowerShell 5.1 vs 7 (checked 2026-11-16)
5. [The Open Group: Shell command language, exit status](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html) — exit status and signal conventions (checked 2026-11-16)
6. [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/) — config, data and cache locations (checked 2026-11-16)
7. [ShellCheck](https://www.shellcheck.net/) — linting shell scripts (checked 2026-11-16)
