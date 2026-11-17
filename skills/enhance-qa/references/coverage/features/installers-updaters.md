---
module: installers-updaters
kind: feature
title: Installers and updaters
checked: 2026-11-16
---
# Installers and updaters

Covers getting the product onto a machine and keeping it current: install, upgrade from the previous version with data kept, downgrade, uninstall, auto-update (signatures, rollback, offline), first launch after update, permissions at install, and low disk space. It applies to desktop apps, CLIs, mobile builds (test tracks), and browser extensions. Platform specifics live in the platform modules (`windows-desktop.md`, `macos-desktop.md`, `linux-desktop.md`, `electron-tauri.md`, `cli-devtools.md`); signing and store rules live in `../gates/windows-code-signing.md`, `../gates/macos-notarization.md` and `../gates/microsoft-store.md`. Goes with `settings-persistence.md`. **Test only in a VM, sandbox or throw-away machine, never on the user's main machine.**

## Signals

- Installer config: `electron-builder`, `squirrel`, `Tauri updater`, `WiX`, `NSIS`, `Inno Setup`, `MSIX`, `pkgbuild`, `.dmg`, `Sparkle`, `deb`/`rpm` specs, `Flatpak`/`Snap` manifests, `winget` manifests, `Homebrew` formulae, `electron-updater`, `WinSparkle`.
- Update feeds or release channels: `latest.yml`, `appcast.xml`, GitHub Releases, `update.json`.
- README "Download" and "Update" sections; auto-update setting in the UI.
- Mobile: TestFlight, Play internal testing tracks; staged rollouts.

## Kickoff questions

1. Which install channels and OS versions are supported, and which previous versions must upgrade? (best guess: the last release, on current Windows 11, macOS and Ubuntu)
2. Does it auto-update, and from where (own server, GitHub Releases, a store)? (best guess: found in the config)
3. Is a clean VM or snapshot available for repeated installs? (best guess: use a VM or container; otherwise limit checks to what a throw-away user account allows)

## Drivers

1. **Silent install and uninstall commands in a VM or container.** Windows: `msiexec /i app.msi /qn /l*v log.txt`, `setup.exe /S` (NSIS), `/VERYSILENT` (Inno), `Add-AppxPackage`, `winget install --manifest`, `winget uninstall`; macOS: `hdiutil attach`, `installer -pkg ... -target /`, `spctl --assess`, `codesign --verify --deep --strict`; Linux: `dpkg -i`, `apt install ./x.deb`, `rpm -i`, `flatpak install`, `snap install --dangerous`. Check exit codes and logs. Cheapest and deterministic.
2. **Before-and-after state diff.** Snapshot files, registry (`reg export`), services, scheduled tasks, shortcuts, PATH, login items and launch agents before install and after install/uninstall (`Get-ChildItem -Recurse`, `diff`, Sysinternals `Autoruns`, `find / -newer`). The way to prove uninstall is clean.
3. **VM snapshots.** Hyper-V, VirtualBox, UTM, Tart, Docker (for CLIs and Linux packages). Restore to a clean state between runs.
4. **Local update server.** Serve a feed on `localhost` (`python -m http.server`, a mock appcast) with controlled versions, broken signatures, truncated downloads, slow transfers and 404s; point a test build at it. Never test auto-update against the live feed in a way that could push a bad build to real users.
5. **Signature and integrity tools.** `signtool verify /pa /v`, `Get-AuthenticodeSignature`, `codesign -dvv --verify`, `spctl -a -vv`, `pkgutil --check-signature`, `gpg --verify`, `sha256sum`; Windows `sigcheck`.
6. **Disk and permission shaping.** Small virtual disk or quota, a tmpfs, a read-only directory, a non-admin user, a locked file.
7. **Mobile install drivers.** `adb install -r`, `adb uninstall`, `adb shell pm`, `xcrun simctl install/uninstall`; real update-over-update only on a device or test track.

**Can't be driven here:** the real store update pipeline (App Store, Play, Microsoft Store staged rollouts), Gatekeeper or SmartScreen reputation on first public download, OS auto-update scheduling, and behaviour on a real user's long-lived machine with years of leftovers. Those become device, human or gate checks. Don't run installers from untrusted sources on the main machine.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Clean VM: install, launch, reach the main screen, uninstall |
| check | Smoke, plus upgrade from the previous version with data |
| full | OS version × install type (fresh, upgrade, repair, per-user vs per-machine) × privilege (admin, standard user) × path (default, with spaces, non-ASCII, long) × update path (online, offline, bad signature) |
| release | Full, plus every supported old version, plus downgrade and low-disk, plus a real-device pass and the signing gate |

Dimensions: OS and version, architecture (x64, arm64), install scope, privilege level, install path, previous version, update channel (stable, beta), network state, disk space, locale.

## Check catalogue

### Fresh install
- [high · auto] On a clean VM, run the installer silently → exit code 0 (or the documented code), no errors in the install log, files in the expected folder, a launchable shortcut or command {smoke}
- [high · agent] Launch right after install → the first screen appears; first-run setup works; no missing-DLL, "damaged app", missing runtime or permission error {smoke}
- [high · auto] Verify the signature on the installer and the installed binaries (`signtool verify /pa`, `codesign --verify --deep --strict`, `spctl -a -vv`) → valid, trusted publisher name, timestamped; no unsigned executables {security}
- [medium · auto] Download size and checksum → match the published values; the file isn't truncated; HTTPS download page
- [medium · agent] Installer UI (interactive run): welcome, licence, folder choice, options, progress, finish → each page works; Back and Cancel work; Cancel mid-way leaves nothing behind; text has no typos or placeholders
- [medium · agent] Install with default and custom paths: with spaces, non-ASCII characters, a long path and another drive → works, or refuses with a clear message
- [medium · agent] Per-user vs all-users install → each puts files and settings in the right place; a standard user can install per-user without admin if the product claims it
- [medium · agent] Install as a standard user without admin rights where admin is needed → a clear elevation prompt or message, not a silent failure
- [medium · agent] Install while the app (or an older version) is running → asks to close it or handles the locked files; no half-installed state
- [medium · agent] Installing twice (repair or reinstall over the same version) → idempotent; no duplicate shortcuts, services or PATH entries
- [medium · agent] Architecture and OS gating: unsupported OS version or CPU → refuses with a clear message; supported ones (arm64 and x64) both launch natively
- [medium · agent] Dependencies and runtimes (VC++ redistributable, .NET, Java, WebView2, system libraries) → bundled or installed or checked; a missing one gives a helpful message
- [low · agent] CLI install methods (npm -g, pip, brew, winget, scoop, curl-pipe-shell) → each installs the same version; the command is on PATH in a new shell; `--version` matches; see `cli-devtools.md`

### Permissions and system changes at install
- [high · auto] Diff the system before and after install → only expected changes: no surprise services, startup entries, scheduled tasks, firewall rules, browser extensions, default-app changes, background daemons or bundled third-party offers {security}
- [medium · agent] Admin or root rights requested → only when needed, with a reason; per-user alternative offered where possible
- [medium · agent] Firewall, network and OS permission prompts at first launch (macOS camera, Windows firewall, Linux polkit) → each is expected, explained and not repeated every launch
- [medium · agent] File type, URL scheme and protocol registrations → work (double-click a file, open a link); and are removed on uninstall
- [medium · agent] Start menu, desktop, dock and launcher entries; icons and the displayed name, publisher, version and size in "Installed apps" → correct and consistent with the product's name
- [medium · agent] Autostart at login → off unless asked, or clearly offered; the setting works and persists
- [low · agent] Installer telemetry and bundled offers → disclosed; opt-in; matches the privacy policy (see `privacy-consent.md`)

### Upgrade from the previous version
- [high · agent] Install the previous release, create real-looking data and non-default settings, then install the new build over it → data and settings are all there, the app launches, nothing re-asks for sign-in or first-run unless documented {smoke}
- [high · agent] Upgrade from each supported older version (oldest to previous) → migrations run in order; no crash; data valid; version number updated (see `settings-persistence.md`)
- [medium · auto] After upgrade, diff files → old files removed or replaced; no stale DLLs, dead services or duplicate entries; the version shown in the app and in the OS equals the new one
- [medium · agent] Upgrade while the app is running or mid-task (a long export) → warns and closes safely, or finishes the task; no data loss
- [medium · agent] Upgrade interrupted (kill the installer, power off the VM, lose network) → the old install still works, or a repair completes it; no bricked state
- [medium · agent] Per-user install upgraded by a different admin install (and the reverse) → one coherent install; no two copies fighting
- [medium · agent] Data migrations on large data (a big database) → completes with progress; free disk need stated
- [medium · agent] Plugins, extensions and user-installed content → kept and still compatible, or the user is told what was disabled
- [medium · agent] License or activation survives the upgrade → no re-activation unless documented

### Downgrade
- [medium · agent] Install an older version over the newer one → blocked with a clear message ("a newer version is installed"), or works and handles newer data safely; never corrupts the user's data silently
- [medium · agent] Roll back through the product's own mechanism (previous-version link, store rollback) → restores a working older version; data from the new version is kept, converted or clearly labelled unreadable

### Uninstall
- [high · auto] Uninstall silently, then diff the system against the pre-install snapshot → program files, services, shortcuts, PATH, file associations, startup entries, firewall rules, scheduled tasks and registry entries are removed; leftovers are only user data the product explains {smoke}
- [high · agent] Uninstall asks whether to keep or remove user data (settings, projects, caches), or says what it does → the choice is respected; "keep" really keeps; "remove" really removes, including caches and keychain/credential entries the product created
- [medium · agent] Uninstall while the app is running → closes it or asks the user to; no locked files left behind
- [medium · agent] Uninstall from each route (OS settings, package manager, the app's own uninstaller, drag to trash on macOS) → all leave the same clean state; macOS apps document where support files remain
- [medium · agent] Reinstall after uninstall with data kept → data is found and used; after data removed → a true first run (see `onboarding.md`)
- [medium · agent] Uninstall leaves browser extensions and native-messaging hosts removed, or tells the user how → true
- [medium · agent] Uninstall of a service or driver (kernel components) → stops and removes cleanly; no reboot loop
- [low · agent] Residual size on disk and in caches after uninstall → within what the product declares

### Auto-update
- [high · agent] Point a test build at a local update feed that offers a newer valid signed build → the app notices, tells the user, downloads, verifies, installs and restarts into the new version; the shown version is the new one; the user's data is intact {smoke}
- [high · auto] Feed offers a build with a wrong, missing or tampered signature, or a modified hash → the update is rejected, not installed; the app keeps running the old version and shows a safe message {security}
- [high · auto] Feed served over plain HTTP, or redirecting to HTTP or another host → refused, or the signature check still protects the user; no downgrade attack by an old signed build being offered (version must increase) {security}
- [high · agent] Offline during check, during download and during install → no crash; retries later; a partial download resumes or restarts; a half-installed update never replaces a working install
- [high · agent] Update fails halfway (disk full, killed, corrupt file, crash on first launch of the new build) → automatic rollback to the previous working version, or a one-click repair; the app is never left unlaunchable
- [medium · agent] Update prompts: remind later, skip this version, disable auto-update in settings → each works and persists; skip doesn't hide critical security updates if the product says it forces them
- [medium · agent] Critical or forced updates (minimum supported version) → the app explains and offers the update; no infinite loop when the update is unavailable
- [medium · agent] Update in the background while the user works → no stolen focus, no sudden restart that loses unsaved work; the restart is offered or happens at a safe time
- [medium · agent] Staged rollout and channels (stable, beta) → switching channel works; a beta user isn't moved to stable by accident, and downgrade rules are stated
- [medium · agent] Delta updates versus full updates → both result in an identical installed tree (hashes match) {security}
- [medium · agent] Updates for a standard user without admin rights → work per-user or elevate clearly; no repeated UAC/password prompts
- [medium · agent] Update feed behaviours: 404, 500, malformed JSON or XML, a slow server, a feed with a lower version → no crash; no notification spam; checks use backoff
- [medium · agent] Metered or low-bandwidth connections → large downloads wait for a good connection or ask first where the OS offers the signal
- [low · agent] Release notes in the update prompt → present, match the version, and render in the user's language

### First launch after update
- [high · agent] Launch right after an update → no re-onboarding, no re-consent unless required, no lost login; any "what's new" appears once and can be dismissed {smoke}
- [medium · agent] First launch runs any post-update migrations → time is reasonable; progress shown; no data lost; the second launch is quick
- [medium · agent] Caches and old versions of local databases → cleaned or upgraded; no doubling of disk use
- [medium · agent] Crash on first launch after update → crash reporting (if any) captures it and the rollback path engages (see rollback above)
- [medium · agent] Permissions granted before the update (camera, notifications, files) → still granted; new permissions are requested in context, not all at launch (see `camera-mic-sensors.md`)
- [medium · agent] Notifications of background updaters (Windows scheduled task, macOS launch agent) → one updater only; the old updater is removed

### Disk space and environment
- [high · agent] Install with too little disk space (small virtual disk) → the installer checks first and says how much is needed; a failed install rolls back and leaves the old version working
- [medium · agent] Disk fills during the update download or extraction → handled error; no corrupt install; temporary files cleaned
- [medium · agent] Read-only install folder, a network-drive home, a redirected user profile, a path over 260 characters (Windows), different locales and user names with accents → install and run, or a clear message
- [medium · agent] Antivirus and endpoint security (Windows Defender, SmartScreen, macOS Gatekeeper) → the signed installer isn't blocked as unknown; if it warns, record the exact warning for the signing gate
- [low · agent] Proxy and corporate network → the updater honours system proxy settings, or the docs say how to set one
- [low · agent] Long path names, many files and a slow disk → install time acceptable; progress is accurate

### Packaging and metadata
- [medium · auto] Package metadata (name, version, publisher, description, licence, icon, architecture, minimum OS) → correct and equal across the installer, the OS "installed apps" entry, the About box and the download page
- [medium · auto] Package manager manifests (winget, Homebrew, deb/rpm, Flatpak) → lint cleanly (`winget validate`, `brew audit --strict`, `lintian`, `rpmlint`, `flatpak-builder-lint`) and point at the current version and hash
- [medium · auto] Installer contains no source maps, test keys, debug builds, developer paths, `.env` files or unrelated large files → listing the package contents shows none (see `security.md`) {security}
- [low · auto] Licence and third-party notices included and correct

## Gates

- Windows: `../gates/windows-code-signing.md` (Authenticode, SmartScreen), `../gates/microsoft-store.md` (clean uninstall and install-success policies).
- macOS: `../gates/macos-notarization.md`.
- Package managers: `../gates/package-publishing.md`.
- Release is blocked by an unsigned or tampered update being accepted, an update that can leave the app unlaunchable with no rollback, or an uninstall that leaves running services.

## Human-only checks

- [human] Install the signed build on a real, ordinary machine you didn't prepare (a colleague's, with antivirus on) → no scary warnings beyond the normal first-download one; the app runs.
- [human] Over a few days, let a real install auto-update from the staging feed → it updates quietly, you don't lose work, and the app feels the same.
- [human] Read the installer text, licence and update prompts → clear, honest, no pre-ticked extras you wouldn't want.
- [human] Judge whether the uninstall data question is understandable to a non-technical user.

## Known pitfalls

- **Run in a VM, not on the main machine.** A buggy installer test can damage a real system; reset with snapshots.
- **SmartScreen and Gatekeeper warnings on a new certificate or a new publisher** are reputation effects, not necessarily defects; record them for the signing gate.
- **Unsigned dev builds trigger warnings by design.** Test the signed release artefact.
- **Updater tests against the real feed** can ship a test build to users; always use a local or staging feed.
- **Leftover user data after uninstall is often intentional** (a documented "keep my data" choice); only undocumented leftovers are findings.
- **Windows Installer and Squirrel differ** in where they install and how they update; use the matching checks (Squirrel installs per-user in `%LocalAppData%`).
- **macOS drag-to-Applications installs** have no uninstaller; support files in `~/Library` remaining is normal unless the product claims otherwise.
- **Docker is not a desktop.** Package tests in a container don't show desktop integration.
- **Clock and certificate expiry:** a signature valid at build time may show as expired on a machine with a wrong clock; check the timestamp counter-signature.

## Sources

1. [Microsoft Store policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) — 10.2.7 clean uninstall, 10.4.4 install success (checked 2026-11-16)
2. [Windows App Certification Kit tests](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit-tests) — install/uninstall testing guidance (checked 2026-11-16)
3. [Apple: Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) — signing and Gatekeeper expectations (checked 2026-11-16)
4. [Sparkle](https://sparkle-project.org/documentation/) — update feeds and signature verification on macOS (checked 2026-11-16)
5. [electron-builder auto-update](https://www.electron.build/docs/features/auto-update) — update feeds, signing requirements (checked 2026-11-16)
6. [ISTQB CTFL v4.0.1, §2.3 Maintenance testing](https://www.istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf) — migrations, retirement, archive and restore (checked 2026-11-16)
7. [Xbox certification requirements](https://learn.microsoft.com/en-us/gaming/gdk/docs/store/policies/console/certification-requirements) — XR-003 save compatibility across updates (checked 2026-11-16)
