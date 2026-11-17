---
module: windows-desktop
kind: platform
title: Windows desktop apps
checked: 2026-11-16
---
# Windows desktop apps

Covers native Windows apps: Win32, WPF, WinForms, WinUI 3, MAUI on Windows and .NET desktop apps, including installers (MSI, MSIX, EXE setups), uninstall, high DPI and multi-monitor, UAC, file associations and driving the UI with UI Automation. Electron and Tauri apps add `electron-tauri.md`. Store certification is in `../gates/microsoft-store.md` and signing in `../gates/windows-code-signing.md`. It goes with `../features/installers-updaters.md`, `../features/settings-persistence.md`, `../features/accessibility.md` and `../features/security.md`.

## Signals

- `.sln`, `.csproj` or `.vcxproj` with `UseWPF`, `UseWindowsForms`, `Microsoft.WindowsAppSDK`, `net*-windows`; `.xaml` files; `Package.appxmanifest`; C++ with `WinMain`.
- Installer projects: WiX (`.wxs`), Inno Setup (`.iss`), NSIS (`.nsi`), MSIX packaging project, Squirrel or ClickOnce config.
- README words: "Windows", "installer", ".exe", "MSIX", "WPF", "WinUI".

## Kickoff questions

1. How is it installed (MSI, MSIX, EXE setup, Store, portable zip) and per user or per machine? (best guess: read the installer project and manifest)
2. Which Windows versions and CPU types (x64, ARM64) must it support? (best guess: Windows 10 and 11, x64, plus ARM64 if a build exists)
3. Is there a Windows VM, Sandbox or snapshot available for install tests? (best guess: Windows Sandbox if the edition allows; otherwise the dev machine with extra care)

## Drivers

1. **Project tests and `dotnet test`.** Unit and integration tests, then UI tests built on the project's framework (MSTest, xUnit, NUnit with FlaUI or Appium). Read results from the test report.
2. **Windows UI Automation (UIA).** Drive and read any native app through `System.Windows.Automation`, PowerShell with the UIAutomation assemblies, FlaUI (.NET) or `pywinauto` (Python with the UIA backend). UIA trees can contain thousands of elements, so scope the search to one window or one control and cache properties in bulk; print only the names, ids and states you need [1]. WinAppDriver (Appium for Windows) exists for UIA-based tests but check its maintenance status before relying on it.
3. **PowerShell and the shell for installers.** `msiexec /i app.msi /qn /l*v install.log`, `msiexec /x`, `Add-AppxPackage`, `Get-AppxPackage`, `winget install --manifest`, `signtool verify /pa /v`, `sigcheck`, `Get-AuthenticodeSignature`. These are deterministic and cheap [2].
4. **File, registry and process diffs.** Snapshot before and after install, use and uninstall with a script (`Get-ChildItem -Recurse`, `reg export`, `Get-Process`, `Get-Service`, scheduled tasks) and compare.
5. **Windows Sandbox or a snapshotted VM** (Hyper-V) for clean installs. Windows Sandbox needs Pro, Enterprise or Education and virtualisation enabled; Home editions don't have it [3].
6. **Windows App Certification Kit (WACK) CLI** for Store candidates; run `appcert.exe` or the UI [4].
7. **Computer use / screenshots.** Last resort for visual checks (DPI crispness, layout); window at 1280×800 or smaller.

**Can't be driven here:** physical docking and hot-plugging monitors, real touch and pen input, real SmartScreen first-download reputation (it builds over weeks), antivirus and EDR products you don't have, ARM64 hardware if you only have x64, and Narrator or JAWS judgement. These become human or device checks. Approving UAC prompts is done by the user on a real run; the agent doesn't enter admin credentials.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Windows 11, x64, 100% scale, per-user install, standard user, main task |
| check | smoke, plus 150% scale and a second monitor if available, plus changed features |
| full | pairwise over OS (Windows 10, 11) × architecture (x64, ARM64) × scale (100, 150, 200%, mixed) × theme (light, dark, high contrast) × user type (standard, admin) × install scope × username with spaces or non-ASCII × antivirus on |
| release | every installer path (fresh, upgrade, repair, uninstall, silent), signed artifacts, WACK for Store, human checks on real hardware |

Dimensions: OS build; architecture; display scale and multi-monitor mixes; light, dark and high contrast; standard user vs administrator (UAC on); per-user vs per-machine; non-ASCII or long user-profile path; locale and region (decimal comma, date formats); offline; antivirus or SmartScreen active.

## Check catalogue

### Smoke
- [high · auto] Build in Release and run unit tests → build succeeds with no new warnings; tests pass {smoke}
- [high · auto] Install the built installer silently into a clean VM or Sandbox → exit code 0 and the app is listed in Apps & features {smoke}
- [high · agent] Launch from the Start menu, do the main task, close, relaunch → the result and settings persist {smoke}
- [high · auto] Uninstall silently → exit code 0 and the app is no longer listed {smoke}

### Installers (MSI, MSIX, EXE)
- [high · auto] Silent install with the documented switches (`/qn`, `/S`, `/VERYSILENT` or the MSIX equivalent) and a log → exit code 0 (or documented 3010 for reboot needed); no UI appears; log has no errors [5]
- [high · agent] Interactive install: click through every page, cancel at each page, and go Back → cancel leaves nothing behind; text is correct; license text is present; default path is sensible
- [high · auto] Install per user as a standard user, and per machine as admin → per-user needs no elevation and writes under the user profile; per-machine asks for UAC once; each scope's files and registry keys go to the right place
- [high · auto] Diff files, registry, services and scheduled tasks before and after install → only expected changes; nothing in unexpected system folders; no leftover temp files
- [high · agent] Upgrade from the previous release over the top (also per-user to per-machine and the other way) → settings and data kept; one entry in Apps & features, not two; shortcuts not duplicated
- [medium · agent] Downgrade, repair and reinstall → blocked with a clear message or works as documented; repair restores deleted files
- [medium · agent] Install on a path with spaces and non-ASCII characters, a long path, a different drive → works; no hard-coded `C:\Program Files` assumption
- [medium · agent] Install while the app is running, and while another installer runs (Windows Installer busy) → closes the app or asks the user; clear message about the other installer
- [medium · auto] Prerequisites (.NET runtime, Visual C++ redistributable, WebView2) on a clean machine → installed by the installer or a clear message with a link; app doesn't crash on missing runtime
- [medium · auto] Check the MSIX manifest: identity, publisher matches the signing certificate, capabilities requested only as needed, declared file types and protocols → `Add-AppxPackage` succeeds; no unneeded `runFullTrust` without reason
- [medium · agent] Reboot-required and in-use files, pending reboot at install → the installer handles them and says so

### Uninstall and cleanup
- [high · auto] Uninstall from Apps & features, from the installer file and silently → app files, shortcuts, services, scheduled tasks, file associations, firewall rules and PATH entries removed
- [high · auto] Diff the file system and registry after uninstall → only the user's own data stays (documents, optionally settings), and the app says so or asks; no orphaned `HKLM` keys or startup entries
- [medium · agent] Uninstall while the app is running, from the tray, or during an update → the app closes cleanly; no "file in use" dead end
- [medium · agent] Reinstall after uninstall → starts fresh or restores kept settings as documented; no corrupt leftovers
- [low · agent] Uninstall prompt wording and "keep my data" choice → clear and works

### High DPI and multi-monitor
- [high · agent] Run at 100%, 125%, 150%, 200% and 300% scale → text and icons are sharp, no blurred bitmap stretching, no clipped controls [6]
- [high · device] Drag the window between monitors with different scale → it re-lays out without blur or wrong size; dialogs open on the same monitor
- [medium · device] Change the scale while the app is running, then sign out and in → the app adapts without restart or crashes
- [medium · device] Launch on the second monitor, close it and reopen; unplug the monitor with the window on it → window returns to a visible position on a monitor that exists
- [medium · agent] Window snap, maximise, minimise, restore, and remembered window size and position → restored correctly; never off-screen
- [medium · agent] Check manifest DPI awareness (`PerMonitorV2`) → set; no legacy system-DPI blur on secondary monitors
- [low · agent] Text size setting in Ease of Access (up to 225%) → text scales; no clipping {a11y}

### UAC, permissions and security
- [high · agent] Run as a standard user and as admin → the app works as standard user for ordinary tasks; elevation is requested only for what needs it; no write to `Program Files` or `HKLM` at run time {security}
- [high · auto] Check the manifest `requestedExecutionLevel` → `asInvoker` unless admin is truly needed; no `requireAdministrator` for a normal app
- [medium · auto] Check app data locations → per-user data under `%APPDATA%` or `%LOCALAPPDATA%`; shared data under `%PROGRAMDATA%` with sensible permissions
- [medium · auto] `signtool verify /pa /v` on every exe, dll and the installer → valid signature chain and timestamp on shipped binaries; none unsigned {security} [7]
- [medium · agent] Windows Defender SmartScreen and Smart App Control on a signed build and an unsigned build → expected warnings; the user can see the publisher name on signed builds
- [medium · auto] Search installed files and logs for secrets, test keys, `.pfx` files and debug symbols not meant to ship → none {security}
- [medium · agent] DLL search order, install folder write permissions → standard users can't replace the app's DLLs in a per-machine install {security}

### File associations, protocols and shell integration
- [high · agent] Double-click an associated file type, right-click Open with, and drag a file onto the exe → the app opens that file; if already running, it uses the running instance or opens a new window as designed
- [medium · agent] Associations after install, upgrade and uninstall → set only when the user agreed; removed on uninstall; Windows 10 and 11 "default apps" settings show the app correctly
- [medium · agent] Custom URL protocol (`myapp://`) from a browser and `Win+R` → the app opens with the right argument; hostile arguments are ignored {security}
- [medium · agent] Files with spaces, Unicode names, long paths and network (UNC) paths → opened correctly
- [medium · agent] Context-menu entries, jump lists, taskbar pinning, Start menu tile and notification toasts → work; toast activation opens the right screen
- [low · agent] Autostart at login → only when enabled by the user, shown in Task Manager startup list, can be turned off in the app

### UI, themes and accessibility
- [high · agent] Light, dark and high contrast themes while the app is open → colours follow; text readable; icons visible {a11y}
- [high · agent] UIA tree for each main window (names, control types, automation ids) → every actionable control has a name and role; keyboard focus is visible {a11y}
- [medium · agent] Keyboard only: Tab, Shift+Tab, arrows, Enter, Esc, Alt access keys, Ctrl+C/V/Z/A → every function reachable; standard shortcuts work {a11y}
- [medium · device] Narrator or NVDA on a real run of the main task → controls announced; focus order logical {a11y}
- [medium · agent] Touch, pen and mouse on a touch screen if claimed → targets large enough; no hover-only actions
- [medium · agent] Language and regional settings (decimal comma, 24-hour time, long and RTL languages) → formats and layout correct

### Stability and lifecycle
- [high · agent] Open the app twice → single instance as designed, or a second window works; the second launch forwards its arguments
- [high · agent] Sleep, hibernate and resume; lock and unlock; fast user switching; sign out → the app resumes without crash, with its connection restored
- [medium · agent] Network drop and VPN change mid-task → clear message; automatic recovery
- [medium · agent] Kill the process mid-save (Task Manager) and power-off simulation in a VM → no corrupted data file; a recovery path exists
- [medium · agent] Check Event Viewer (Application log), WER crash reports and the app's log folder after the run → no unhandled exceptions or errors
- [medium · agent] Long run (an hour) with typical use → memory and handle counts stay flat (Performance Monitor or `Get-Process`)
- [low · agent] Run on ARM64 Windows or under x64 emulation if claimed → starts and the main task works; native ARM64 build is faster if shipped

### Store packaging and certification (if applicable)
- [high · gate] Run WACK on the MSIX or installer-based package → all tests pass; failures listed [4]
- [high · gate] Package identity, publisher, version, capabilities, privacy policy URL, age rating and screenshots in Partner Center → match the app; the user submits
- [medium · auto] Check the installer meets the Store's silent, standalone, versioned-URL requirements for EXE and MSI submissions → conforms (see the gate pack)

## Gates

- `../gates/microsoft-store.md` for Microsoft Store policy and WACK.
- `../gates/windows-code-signing.md` for Authenticode signing, timestamps and SmartScreen.
- Release blockers specific to Windows desktop: install or uninstall fails or leaves the machine dirty, unsigned binaries, admin required for normal use, blurry or broken UI at common scales, no silent install when the channel needs one.

## Human-only checks

- [human] On a real Windows laptop with an external monitor at a different scale, drag the window between screens → crisp and correctly sized on both
- [human] Download the signed installer from the real download link on a machine that has never seen it → note the SmartScreen prompt and that your publisher name shows
- [human] Install and uninstall with a normal (non-admin) account → no surprises; nothing left in Apps & features
- [human] Use Narrator on the main task → doable
- [human] Submit to Partner Center → an agent never submits

## Known pitfalls

- **SmartScreen and Smart App Control warnings** on new or unsigned files are expected until reputation builds; signed files can also warn at first [8]. Not a bug in the code, but a launch risk to report once.
- **Windows Installer exit 3010** means "success, reboot required", not failure.
- **Dev machine isn't clean.** Missing prerequisites and registry leftovers hide on the developer's PC; use Sandbox or a snapshot.
- **UIA names can differ** between WPF and WinUI; an element without a name might still have an automation id. Check both before filing an accessibility bug.
- **Antivirus false positives** on new unsigned builds are a distribution risk; report separately from product bugs.
- **Debug builds and Visual Studio** attached debuggers change timing and DPI behaviour; test the installed Release build.
- **Event Viewer noise** (DCOM, Schannel, third-party) is mostly not the app; filter to the app's source.
- **Windows Sandbox resets** on close; a lost file there isn't a bug.
- **Don't type real admin credentials or use real accounts.** Elevation prompts are for the user to approve.

## Sources

1. [Microsoft: UI Automation tree overview](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-treeoverview) — tree size, control, content and raw views; scoping and caching (checked 2026-11-16)
2. [Microsoft: Windows Installer command-line options](https://learn.microsoft.com/en-us/windows/win32/msi/command-line-options) — `msiexec` quiet install, logging, uninstall (checked 2026-11-16)
3. [Microsoft: Windows Sandbox](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/) — what it is and what editions support it (checked 2026-11-16)
4. [Microsoft: Windows App Certification Kit tests](https://learn.microsoft.com/en-us/windows/uwp/debug-test-perf/windows-app-certification-kit-tests) — crash and hang, BinScope, manifest checks (checked 2026-11-16)
5. [Microsoft: Store policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) — clean uninstall and silent standalone installer rules for submitted apps (checked 2026-11-16)
6. [Microsoft: High DPI desktop application development on Windows](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows) — per-monitor DPI awareness and testing steps (checked 2026-11-16)
7. [Microsoft: SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) — signing, reputation, Smart App Control (checked 2026-11-16)
8. [Microsoft: MSIX overview](https://learn.microsoft.com/en-us/windows/msix/overview) — MSIX package model (checked 2026-11-16)
9. [Microsoft: User Account Control](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works) — elevation behaviour (checked 2026-11-16)
