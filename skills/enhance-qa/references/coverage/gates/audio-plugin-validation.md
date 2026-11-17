---
module: audio-plugin-validation
kind: gate
title: Audio plugin validation (auval, VST3, pluginval, AAX, CLAP)
checked: 2026-11-16
---
# Audio plugin validation (auval, VST3, pluginval, AAX, CLAP)

Release gate for audio plugins and plugin installers: the format validators, AAX signing, macOS notarisation of plugin bundles, installer checks and host scanning. Validators are objective oracles: use them first. They don't test sound or UI feel. Use with `../platforms/audio-plugins.md`, `macos-notarization.md`, `windows-code-signing.md` and `../features/installers-updaters.md`.

## Signals

- A JUCE, iPlug2, DPF, Steinberg VST3 SDK, CLAP or AAX SDK project; `.vst3`, `.component`, `.clap` or `.aaxplugin` bundles in the build output; a CMake `juce_add_plugin`.
- The plan names "auval", "pluginval", "AAX" or a plugin `release` pass.

## Kickoff questions

1. Which formats ship: VST3, AU, AAX, CLAP, standalone? (best guess: read the build targets)
2. Which OSes and architectures: macOS (universal), Windows x64 or ARM, Linux? (best guess: read the CI matrix)
3. Is there an Avid developer account for AAX signing? (best guess: ask; AAX signing needs it)

## Drivers

1. **Command-line validators** (best, cheap, deterministic): `auval` (macOS), the VST3 SDK `validator`, `pluginval`, `clap-validator`. Exit codes and logs decide. Run headless in CI.
2. **Signing and notarisation tools**: `codesign`, `spctl`, `xcrun notarytool`, `stapler`, `signtool`, PACE `wraptool` for AAX. Exact.
3. **Real hosts scripted or manual.** Reaper (scriptable, free to evaluate) for scans, load, render and project recall; other DAWs by hand. Offline render compare with a reference WAV.
4. **Clean VM or machine** for installer runs.

**Can't be driven here:** listening tests, GUI feel, licensed DAWs behind dongles (Pro Tools), real audio interfaces, Logic's own AU rules, and Avid and PACE accounts. These are human or device checks. A Windows PC can't run auval, AU or notarisation.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | pluginval on each format at a stated level, plus the format validator |
| full | check, plus host load tests and installer runs on clean VMs |
| release | full, plus signing, notarisation, AAX and human listening |

Dimensions: format (VST3, AU, AAX, CLAP) × OS and architecture (macOS arm64 and x86_64, Windows x64, Linux) × host × sample rate × buffer size.

## Check catalogue

### Validators
- [high · auto] `pluginval --strictness-level 5 --validate <plugin>` for each of VST3 and AU (and the VST2 build if shipped), headless → exit code 0; level 5 is the commonly accepted floor for host compatibility (see Sources 3) {smoke}
- [medium · auto] `pluginval` at a higher level (6 to 10; for example 8 or 10 for a release candidate) with `--sample-rates`, `--block-sizes`, `--repeat` and `--randomise` → exit 0; higher levels add parameter fuzzing, state restore, thread-safety and allocation checks
- [high · auto] `auval -v <type> <subtype> <manufacturer>` for each Audio Unit on macOS (`auval -a` first to list) → ends with "AU VALIDATION SUCCEEDED"; no ERROR or FAIL lines; WARNINGs reviewed (see Sources 1)
- [high · auto] VST3 SDK `validator <plugin.vst3>` → all tests pass, no errors (see Sources 2)
- [high · auto] `clap-validator validate <plugin.clap>` → no failed tests; experimental fuzz runs reviewed (see Sources 4)
- [medium · auto] Run each validator on both release builds and the exact installed copy → results are the same for the shipped file, not just the build folder
- [medium · auto] Run with real-time checks if available (`pluginval --rtcheck`, or sanitizers in a test build) → no allocation, lock or unbounded work on the audio thread (check the flag exists in your pluginval version)
- [medium · auto] Compare a render of a fixed input and state against a stored reference WAV (null test) → difference within the stated tolerance; no NaN or inf in output
- [high · auto] Fresh plugin ID, manufacturer code and bundle ID are unique and unchanged from the last release → the ID didn't change by accident, since changing it breaks users' projects

### Host scanning and loading
- [high · agent] Scan the installed plugin in Reaper (and other available hosts) on a clean profile → it appears, scans with no crash, and loads on a new track
- [high · agent] Load, run audio, change a parameter, save the project, reopen it → state restores exactly
- [medium · agent] Run at 44.1, 48, 96 kHz and 64, 512, 2048 sample buffers, and with variable block sizes → no clicks or crash; offline render matches real-time
- [medium · agent] 16 or more instances at once, and load-unload loops → no crash or leak
- [medium · agent] Automate a parameter and change presets while playing → no zipper noise or crash
- [high · device] Logic Pro (AU) and Pro Tools (AAX) on real machines → each loads, validates in the host's own scan and plays
- [medium · device] Other hosts users care about: Ableton Live, Cubase, FL Studio, Bitwig, Studio One → load and run
- [medium · human] Listening test on a reference project → sounds right; no artifacts

### AAX and signing
- [high · gate] AAX plug-ins are signed through PACE with the developer's Avid-approved account, since retail and beta Pro Tools load only signed plug-ins; developer builds load unsigned (see Sources 5)
- [medium · auto] Verify the AAX signature with the PACE/`wraptool` verify command and a signed build in Pro Tools → loads in a retail Pro Tools
- [medium · device] Run DigiShell tests on the AAX build (instantiation, performance, cancellation) → no failures (see Sources 5)

### macOS notarisation and Windows signing for plugin bundles
- [high · auto] `codesign --verify --deep --strict` on each `.vst3`, `.component`, `.clap`, `.aaxplugin` → valid, with Developer ID and a secure timestamp; see `macos-notarization.md`
- [high · gate] Notarise the installer (PKG or DMG) or the bundles, then staple → accepted; quarantined plug-ins load on macOS 10.15 and later only if notarised, otherwise the user must approve (see Sources 6)
- [medium · device] Download the installer on a clean Mac and install, then scan in a host → loads without a Gatekeeper block
- [high · auto] On Windows: `signtool verify /pa` on the plugin DLLs and the installer; see `windows-code-signing.md` → signed with a timestamp

### Installer
- [high · agent] Install on a clean VM: plugin folders are the standard ones for each format (for example `/Library/Audio/Plug-Ins/VST3`, `%COMMONPROGRAMFILES%\VST3`), with the right permissions → host finds them
- [medium · agent] Upgrade over the previous version, then downgrade → settings and presets stay; no duplicate copies
- [medium · agent] Uninstall → plugins, presets and files the installer put there are removed; user presets stay (documented)
- [medium · agent] Install without admin rights if a user-level install is offered → goes to user folders and is found by hosts
- [medium · agent] License or copy-protection flow, if any: activate, deactivate and offline use on test licences → works; no real licence key in logs

## Gates

Validators pass (pluginval at the stated level, `auval` success, VST3 validator and clap-validator clean), bundles and installers are signed and notarised, AAX is PACE-signed, and the host load and installer lines pass on clean machines.

## Human-only checks

- [human] Hold Apple, Avid and PACE accounts and run signing and notarisation. Agents never type those credentials.
- [human] Load the release in your own main DAW and play a real project for ten minutes. Judge: sound, latency, GUI feel.
- [human] Install from the downloaded installer on a second machine.

## Known pitfalls

- `auval` output text and the Apple technote are old (the technote dates from 2008 and is no longer updated). Judge by the final success line and ERROR or FAIL lines, and note the macOS version.
- It's widely reported that Logic requires an AU to pass auval, but this isn't stated in Apple's technote. Treat it as likely, not certain.
- pluginval levels above 5 are stricter than many hosts need. A failure at level 7 or above is a real bug but may not block users; set severity with the team.
- Validators don't test the UI or sound. A pass doesn't mean the plugin is good.
- A plugin ID or manufacturer code change looks like a new plugin and breaks saved projects.
- Hosts cache scan results. Clear the cache before re-testing.
- Pro Tools and some DAWs need dongles or accounts; don't mark those passed without a device.

## Sources

1. [Audio Unit Validation Using auval (Apple TN2204)](https://developer.apple.com/library/archive/technotes/tn2204/_index.html) — auval phases; the technote is old (checked 2026-11-16 via research note 2)
2. [VST 3 validator (Steinberg)](https://steinbergmedia.github.io/vst3_dev_portal/pages/What+is+the+VST+3+SDK/Validator.html) — command-line conformity checks (checked 2026-11-16 via research note 2)
3. [pluginval (Tracktion)](https://github.com/Tracktion/pluginval) — strictness levels 1 to 10, level 5 floor, exit codes (checked 2026-11-16 via research notes 2 and 5)
4. [clap-validator](https://github.com/free-audio/clap-validator) — CLAP validation and fuzzing (checked 2026-11-16 via research note 2)
5. [AAX signing with PACE](https://paceap.com/getting-started-with-aax-code-signing-for-pro-tools-plugins/) and [AAX SDK docs](https://learn-cdn.avid.com/AAX_SDK_2p1p1/Documentation/Doxygen/output/html/a00274.html) — signed plug-ins in retail Pro Tools, DigiShell tests (checked 2026-11-16 via research note 2)
6. [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) — quarantined plug-ins and notarisation (checked 2026-11-16 via research notes 2 and 5)
