---
module: linux-desktop
kind: platform
title: Linux desktop apps
checked: 2026-11-16
---
# Linux desktop apps

Covers native Linux desktop apps (GTK, Qt, and other toolkits) and how they're packaged and installed: deb, rpm, Flatpak, Snap and AppImage. It covers Wayland vs X11, desktop integration (`.desktop` files, icons, MIME types), HiDPI scaling and the distro matrix. Electron and Tauri apps add `electron-tauri.md`. It goes with `../features/installers-updaters.md`, `../features/settings-persistence.md`, `../features/accessibility.md` and `../features/security.md`.

## Signals

- `meson.build`, `CMakeLists.txt` with `find_package(Qt6)` or `GTK`, `Cargo.toml` with `gtk4` or `iced`, `*.ui` files, Python with `PyGObject` or `PyQt`.
- Packaging files: `debian/control`, `*.spec`, `*.desktop`, `*.metainfo.xml`, a Flatpak manifest (`*.yml` with `runtime:`), `snapcraft.yaml`, `AppImageBuilder.yml`, `appimagetool`.
- README words: "Linux", "Flatpak", "AppImage", ".deb", "Wayland".

## Kickoff questions

1. Which package formats ship and for which distros? (best guess: from the packaging files; test Ubuntu LTS and Fedora for deb and rpm)
2. Which toolkit and which display servers must work (X11, Wayland, both)? (best guess: both, with Wayland as the default on current GNOME and KDE)
3. Do we have containers or VMs for distros? (best guess: Docker for headless package checks, a VM for GUI runs)

## Drivers

1. **Package and metadata linters.** `lintian` (deb), `rpmlint` (rpm), `desktop-file-validate`, `appstreamcli validate` (AppStream metainfo), `flatpak-builder-lint`, `snapcraft` lint and `snap` review tools, `appimagelint`. Deterministic, cheap, and the first step for every package [1][2].
2. **Containers and VMs for install checks.** Docker or Podman images of Ubuntu LTS, Debian, Fedora and Arch for `apt install ./app.deb`, `dnf install ./app.rpm`, then `--version` and removal. Snapshotted VMs (QEMU, VirtualBox, GNOME Boxes) for GUI runs and desktop integration.
3. **Headless GUI under Xvfb, and Wayland compositors.** Run the app under `xvfb-run` for X11 tests and under a nested or headless Wayland compositor (weston, sway headless, `mutter --headless`) for Wayland. Take screenshots with `import`, `scrot`, `grim` or `gnome-screenshot`.
4. **Accessibility tree and UI scripting.** AT-SPI via `dogtail` or `pyatspi`, `accerciser` for inspection; Qt's own test tool (`QTest`, Squish is commercial). Works for GTK and Qt apps that expose accessibility. `xdotool` drives X11; Wayland has no general input injection, use `ydotool` (needs uinput) or the compositor's test tools.
5. **Toolkit test runners.** `meson test`, `ctest`, `pytest` with `pytest-qt`, `cargo test`. Read reports; run first.
6. **Sanitisers and tracing.** `valgrind`, AddressSanitizer, `strace -f -e trace=file` to see missing files and wrong paths, `ldd` and `readelf -d` for libraries, `journalctl --user` for logs.
7. **Computer use / screenshots.** Last resort for visual checks at 1280×800 or smaller.

**Can't be driven here:** on a Windows or macOS dev machine, a Linux GUI needs WSL2 with WSLg (X11 and Wayland, but not a full desktop environment, so desktop integration, tray, portals and notifications differ) or a VM. Real hardware features (GPU drivers, touchpad gestures, fractional scaling on real monitors, Bluetooth, power management) are device checks. Judgement of how the app fits GNOME or KDE is a human check.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Ubuntu LTS, GNOME, Wayland, the primary package format, main task |
| check | smoke, plus Fedora (rpm or Flatpak) and X11 session, plus changed features |
| full | pairwise over distro (Ubuntu LTS, Debian stable, Fedora, Arch or openSUSE) × desktop (GNOME, KDE Plasma, one lightweight like Xfce) × session (Wayland, X11) × package format × scale (100%, 200%, fractional) × theme × locale |
| release | every package format installed, upgraded and removed on its target distros, plus real hardware for HiDPI and a human desktop-integration pass |

Dimensions: distro and version; desktop environment; Wayland or X11; format (deb, rpm, Flatpak, Snap, AppImage, tarball); architecture (x86_64, aarch64); display scale (1×, 2×, fractional) and mixed-DPI monitors; light, dark; high contrast; language including RTL; sandboxed or not.

## Check catalogue

### Smoke
- [high · auto] Build from a clean checkout and run the tests → build succeeds; tests pass {smoke}
- [high · auto] Install the main package in a clean container or VM and run `app --version` → installs with no dependency errors; prints the right version {smoke}
- [high · agent] Launch the installed app from the application menu (or `gtk-launch`), do the main task, close, relaunch → result persists {smoke}
- [high · auto] Remove the package → the app disappears from the menu; no running processes left {smoke}

### Packaging: deb and rpm
- [high · auto] `lintian` on the `.deb` and `rpmlint` on the `.rpm` → no errors; each warning is listed and judged [1]
- [high · auto] Install on a clean Ubuntu LTS, Debian stable and Fedora container or VM → dependencies resolve from the distro repositories; no manual `apt --fix-broken` needed
- [high · auto] `dpkg -c` and `rpm -qlp` for the file list → files in standard locations (`/usr/bin`, `/usr/share/applications`, `/usr/share/icons`, `/usr/lib/<app>`); nothing in `/home`, `/tmp`, or `/opt` without reason
- [medium · auto] `ldd` and `readelf -d` on binaries → no missing or bundled-conflicting libraries; the minimum glibc version matches the oldest supported distro
- [high · auto] Upgrade from the previous package version (`apt install ./new.deb`, `dnf upgrade`) → config files preserved (conffiles marked); one app version installed; no prompts hang a non-interactive upgrade
- [high · auto] Remove and purge (`apt remove`, `apt purge`, `dnf remove`) → remove leaves user data; purge removes package-owned config; no orphaned services, timers or alternatives
- [medium · auto] Maintainer scripts (postinst, prerm) → idempotent, don't fail on re-run, update icon, desktop and MIME caches when needed
- [medium · auto] Package metadata: name, version, licence, description, homepage, maintainer, architecture → correct, with no placeholders
- [medium · auto] Signature of packages and repository metadata (GPG key) → verifies; the install doc shows the right key fingerprint {security}
- [low · auto] Check architecture packages (amd64, arm64) → each installs and starts on its own architecture

### Packaging: Flatpak
- [high · auto] `flatpak-builder` build and `flatpak-builder-lint` on the manifest and repo → no errors; the app id follows reverse-DNS naming and matches the `.desktop`, metainfo and icon file names [3]
- [high · agent] `flatpak install` the bundle, run, then `flatpak run --command=sh` to inspect → the app runs sandboxed; data lives in `~/.var/app/<id>`
- [high · auto] Review `finish-args` (permissions) → each of `--filesystem=host`, `--device=all`, `--socket=x11` and `--share=network` is justified; prefer portals and `--socket=wayland` plus `fallback-x11` {security}
- [medium · agent] File open and save dialogs, camera, screen sharing and notifications through portals → work inside the sandbox; no "permission denied"
- [medium · agent] Uninstall (`flatpak uninstall --delete-data`) → app and data removed
- [medium · auto] Runtime version → supported (not end-of-life) at release time

### Packaging: Snap
- [high · auto] `snapcraft` build, `snap install --dangerous`, and run → runs with confinement as declared (strict, classic only if approved) [4]
- [high · auto] Review `plugs` and interfaces and connection state (`snap connections <name>`) → each interface is needed; auto-connections don't fail silently; the app explains missing permission
- [medium · agent] Snap refresh (update) and revert → data kept across revisions (`snap revert`); no corrupt `$SNAP_USER_DATA`
- [medium · agent] Home directory and removable media access under strict confinement → the app handles denial with a message
- [medium · agent] Start-up time of the first launch from a squashfs mount → acceptable; note it separately from later launches

### Packaging: AppImage and tarballs
- [high · agent] Download the AppImage, `chmod +x`, run on a clean Ubuntu LTS, Fedora and Debian VM → starts without installing extra libraries (FUSE 2 may be missing on new distros; the app or docs say how to run with `--appimage-extract-and-run`) [5]
- [medium · auto] `appimagelint` or manual `ldd` on bundled libraries → no libraries newer than the oldest target's glibc; no bundled copy of a library that must come from the system (GL, graphics drivers)
- [medium · agent] Desktop integration for an AppImage (menu entry, icon) via the user's tool or the app's self-integration → creates a valid entry; removal works
- [medium · agent] Auto-update inside an AppImage (AppImageUpdate zsync, or the app's updater) → updates to the new file; signature checked if claimed {security}
- [low · agent] Tarball install: extract to a path with spaces → runs; no hard-coded paths

### Desktop integration
- [high · auto] `desktop-file-validate` on the `.desktop` file → exits 0; `Name`, `Exec`, `Icon`, `Type`, `Categories` set; `Exec` uses `%U` or `%F` where files or URLs are accepted; `StartupWMClass` matches the real window class [6]
- [high · auto] `appstreamcli validate` on the `*.metainfo.xml` → no errors; summary, description, screenshots, licence, release entries, content rating and `launchable` are present [7]
- [high · agent] Open the application menu, search by name, check icon, name and category, then pin to the dock and check the running window is grouped under the same icon → one icon; the window matches the launcher (Wayland `app_id` or X11 class set)
- [medium · auto] Icons: scalable SVG or PNGs at standard sizes (16 to 512) installed in the hicolor theme with the app id name → icon shows at every size and in dark and light shells; no blank placeholder [8]
- [high · agent] MIME types and file associations: double-click a file, right-click Open With, `xdg-open file`, `xdg-mime query default <type>` → the app opens the file; associations declared in the `.desktop` `MimeType=` line and a MIME XML file where new types are defined [9]
- [medium · agent] URL scheme handlers (`x-scheme-handler/myapp`) via `xdg-open myapp://…` → app opens with the URL; hostile parameters ignored {security}
- [medium · agent] After install and removal, desktop, icon and MIME caches updated → no stale icon or association (`update-desktop-database`, `gtk-update-icon-cache` run by the package)
- [medium · agent] Notifications, tray or status icon (StatusNotifierItem on KDE, extensions on GNOME), and autostart entries (`~/.config/autostart`) → work where the desktop supports them; the app has a fallback when there is no tray
- [medium · agent] XDG directories: config in `~/.config`, data in `~/.local/share`, cache in `~/.cache`, runtime in `$XDG_RUNTIME_DIR`; honours `XDG_*` overrides → files in the right places; no clutter in `$HOME`
- [low · agent] Single-instance behaviour via D-Bus activation → second launch focuses the first window and passes files

### Wayland vs X11
- [high · agent] Run the main flow on a Wayland session and on an X11 session → same behaviour; differences are filed with the session type named [10]
- [high · agent] Check that the app runs native Wayland (not just XWayland): `xeyes` test, `xlsclients`, or `WAYLAND_DEBUG`; Qt `QT_QPA_PLATFORM=wayland`, GTK default → the app picks the right backend; fractional scaling is sharp, not blurry
- [medium · agent] Window features: move, resize, maximise, full screen, minimise, always on top, multiple windows, popups and menus placement → work; popups appear near their parent on Wayland
- [medium · agent] Features Wayland restricts: global shortcuts, screen capture, clipboard managers, window position restore, input injection, remote desktop → use portals (xdg-desktop-portal) and the app explains what's unavailable
- [medium · agent] Drag and drop between the app and the file manager, and copy-paste of text, images and files with other apps → works on both sessions
- [medium · agent] IME and keyboard layouts (compose keys, ibus, fcitx, international layouts) → text entry correct for CJK and accented characters

### HiDPI, themes and accessibility
- [high · agent] Run at 100%, 200% and fractional (125%, 150%) scale, and with mixed monitors → crisp text and icons; no tiny or giant widgets; window sizes sensible [11]
- [medium · agent] Light, dark and high-contrast themes, and a different icon theme (Adwaita, Breeze) → readable; icons visible; custom colours follow the system where promised
- [medium · agent] GTK app on KDE and Qt app on GNOME → follows the platform theme acceptably or uses a bundled theme in a consistent way
- [medium · agent] Large text (system text scaling) → text grows; no clipping {a11y}
- [medium · agent] Keyboard only: Tab, arrows, Enter, Esc, mnemonics, standard shortcuts → everything reachable; focus visible {a11y}
- [medium · agent] AT-SPI tree (Accerciser or dogtail) for the main windows → every control has name and role {a11y}
- [medium · device] Orca screen reader on the main task → controls announced; navigation possible {a11y}
- [medium · agent] Right-to-left and long-text locales → layout mirrors; no truncated labels

### Distro matrix and compatibility
- [high · auto] Run the install and launch check on Ubuntu LTS, a newer Ubuntu, Debian stable, Fedora and Arch (or openSUSE) → starts on each; failures list the distro and the missing library or setting
- [medium · agent] Different desktop environments (GNOME, KDE, Xfce) → the app opens, menus and dialogs work; each deviation judged against the platform convention
- [medium · agent] Different C libraries or runtimes (glibc vs musl on Alpine if claimed), Python and Qt versions from the distro → supported versions work; unsupported ones give a clear message
- [medium · auto] Check dependencies with `ldd` against the oldest supported distro → no symbol version errors (`GLIBC_2.xx not found`)
- [low · device] Different GPUs and drivers (Intel, AMD, NVIDIA, software rendering) → renders correctly; falls back to software when GL isn't available

### Stability and security
- [high · agent] Sleep and wake, lock and unlock, logout, network change, and monitors plugged and unplugged → app recovers without crash
- [medium · agent] `journalctl --user` and the terminal output during a full run → no crashes, GLib criticals or segfaults; warnings noted
- [medium · agent] Run as a normal user without `sudo`; check for any `setuid`, polkit use or root-owned files in the user's home → none unless intended {security}
- [medium · auto] Search the package for secrets, test keys and debug builds → none {security}
- [medium · agent] Crash handling and core dumps (`coredumpctl`) → no crash in normal use; crash reports don't include private paths unless the user agrees

## Gates

- No store gate pack applies by default; distribution channels have their own rules (Flathub review, Snap Store review, distro packaging policy). Treat their linters as the gate: `flatpak-builder-lint`, `appstreamcli validate`, `lintian`, `rpmlint`, and `snapcraft` review.
- Release blockers specific to Linux desktop: package fails on a supported distro, invalid `.desktop` or metainfo, missing icon, no Wayland support on a default-Wayland desktop with no X11 fallback, data written outside XDG paths, sandbox permissions broader than needed.

## Human-only checks

- [human] On a real Linux laptop with a HiDPI screen, run the app under Wayland and X11 → crisp, correctly sized, no blur
- [human] Install through the real channel (Flathub test build, Snap edge channel, your repository) as a normal user → installs, appears in the menu with the right icon, and uninstalls cleanly
- [human] Use the app on GNOME and on KDE for the main task → looks native enough; tray, notifications and file dialogs behave
- [human] Try Orca on the main task → doable
- [human] Publish to Flathub, Snap Store, or a repository → an agent never publishes

## Known pitfalls

- **WSL2 and containers aren't a full desktop.** WSLg lacks a real session, portals and tray; a missing tray icon or notification there is the environment, not the app.
- **Headless compositors and Xvfb** have no real GPU, no window manager (Xvfb), and different DPI; don't file layout bugs seen only there without a real session check.
- **Missing FUSE for AppImage** on new Ubuntu and others is a known environment issue; check the docs mention it before filing [5].
- **GNOME has no tray by default.** Absence of a status icon on stock GNOME is expected unless the app depends on an extension.
- **Wayland blocks things on purpose.** Global hotkeys, window positioning and screen capture without portals fail by design; the question is whether the app handles it.
- **Distro-specific theme quirks** (Ubuntu's Yaru, Fedora's Adwaita) change icons and colours; compare on a second distro before filing.
- **Icon and desktop caches go stale.** A missing new icon right after install may need a cache update or relogin; check that the package triggers it.
- **Package manager prompts** in containers need `DEBIAN_FRONTEND=noninteractive`; a hanging prompt in a script isn't necessarily an app bug.
- **Never run installs as root on the user's real machine.** Use containers, VMs and test accounts.

## Sources

1. [Debian: Lintian](https://lintian.debian.org/) — deb package checks (checked 2026-11-16)
2. [freedesktop.org: Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/) — `.desktop` fields and validation (checked 2026-11-16)
3. [Flatpak documentation](https://docs.flatpak.org/) — manifests, permissions, portals, app ids, linting (checked 2026-11-16)
4. [Snapcraft documentation](https://snapcraft.io/docs) — confinement, interfaces, plugs, refresh and revert (checked 2026-11-16)
5. [AppImage documentation](https://docs.appimage.org/) — building, running, FUSE, glibc compatibility (checked 2026-11-16)
6. [freedesktop.org: Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/) — `Exec` field codes, `MimeType`, `StartupWMClass` (checked 2026-11-16)
7. [freedesktop.org: AppStream documentation](https://www.freedesktop.org/software/appstream/docs/) — metainfo and `appstreamcli validate` (checked 2026-11-16)
8. [freedesktop.org: Icon Theme Specification](https://specifications.freedesktop.org/icon-theme-spec/latest/) — icon sizes and hicolor theme (checked 2026-11-16)
9. [freedesktop.org: Shared MIME-info Specification](https://specifications.freedesktop.org/shared-mime-info-spec/latest/) — MIME types and associations (checked 2026-11-16)
10. [Qt: Qt for Wayland](https://doc.qt.io/qt-6/wayland-and-qt.html) — Wayland vs X11 platform plugins (checked 2026-11-16)
11. [GTK documentation](https://docs.gtk.org/gtk4/) — scaling and platform notes for GTK 4 (checked 2026-11-16)
