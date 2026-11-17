---
module: audio-plugins
kind: platform
title: Audio plugins and standalone audio apps (VST3, AU, AAX, CLAP)
checked: 2026-11-16
---
# Audio plugins and audio apps

Covers audio plugins in VST3, Audio Unit (AU), AAX and CLAP formats (effects, instruments, MIDI tools), and standalone audio apps (synths, samplers, editors, DAWs, utilities). The survey behind this library found no other agent skill covering this area, so this module is deliberately deep. It centres on deterministic validators (pluginval, `auval`, the Steinberg VST3 validator, clap-validator), render and null tests, and a host matrix. Audio quality and feel are human judgements. It goes with `windows-desktop.md` or `macos-desktop.md` (and `linux-desktop.md`), `../features/installers-updaters.md`, `../features/settings-persistence.md`, `../features/accessibility.md` for the UI, and for release `../gates/audio-plugin-validation.md` (also `../gates/macos-notarization.md`, `../gates/windows-code-signing.md`).

## Signals

- JUCE (`JuceHeader.h`, `.jucer`, `juce_add_plugin` in CMake), iPlug2, DPF, VST3 SDK (`public.sdk`, `IAudioProcessor`), CLAP (`clap/clap.h`, `clap_plugin_entry`), AAX SDK, `AudioUnit` or `AUv3` extension targets, nih-plug (Rust), Cmajor, FAUST, SuperCollider, Csound.
- Output bundles named `*.vst3`, `*.component`, `*.aaxplugin`, `*.clap`, or a standalone app target.
- README words: "VST3", "AU", "AAX", "CLAP", "DAW", "plugin", "preset", "latency".

## Kickoff questions

1. Which formats, operating systems and CPU architectures ship, and are they effects, instruments or both? (best guess: VST3 and AU on macOS and Windows, x64 and arm64; read the build targets)
2. Which DAWs do you own or can test in, and which must work? (best guess: Reaper, which has a free evaluation and a command-line render; any others the user owns are human checks)
3. Is there copy protection or licensing (serial, iLok, online activation)? (best guess: none; if yes, test accounts only and the user does activation checks)

## Drivers

Best first. Everything deterministic is automated; listening and DAW GUIs are human.

1. **pluginval.** The cross-platform validator from Tracktion; run it headless on every built format. Strictness levels 1 to 10: level 1 plugin info; level 2 state; level 3 audio processing and automation looped across sample rates and block sizes, and editor DPI; level 4 bus layouts and opening the editor while processing; level 5 runs `auval` and the VST3 validator; level 6 parameter fuzzing, state restoration and editor stress; level 7 parameter thread safety; level 8 larger-than-prepared blocks; level 9 allocations during `process`. Level 5 is the usual floor for host compatibility; aim for 10 on release. Useful flags: `--strictness-level`, `--validate-in-process`, `--sample-rates`, `--block-sizes`, `--repeat`, `--randomise`, `--skip-gui-tests` (for headless CI), `--rtcheck`. Read the exact current options with `pluginval --help`; some features (acceptance mode, `--rtcheck`) are on the develop branch and may not be in the release you install [1].
2. **`auval` (macOS).** `auval -a` lists Audio Units; `auval -v <type> <subtype> <manufacturer>` validates one. Needed for AU. It must pass with exit code 0 and "AU VALIDATION SUCCEEDED". Run after installing to `~/Library/Audio/Plug-Ins/Components` and after clearing the AU cache if a fresh build doesn't show [2].
3. **Steinberg VST3 validator.** The `validator` executable in the VST3 SDK (`validator -e <plugin.vst3>`) checks the module, factory and processor/controller contracts. The SDK also ships the `moduleinfo` tools. Fix every failure; warnings get triaged [3].
4. **clap-validator.** For CLAP: runs tests out of process, checks state reproducibility, fuzzes parameters, notes and transport [4].
5. **Offline render harness.** A small test host (a JUCE or Python script with `pedalboard`, or the plugin's own CLI test target) that loads the plugin, feeds a known input and parameter state, renders to WAV and compares: null test against a golden file (tolerance of about one 16-bit LSB per sample is pluginval's default for acceptance tests; NaN or inf fails), render at different block sizes (must match), offline versus real-time, and impulse alignment for latency. Pedalboard (Spotify, Python) can load VST3 and AU plugins to automate this. Analyse with `soundfile`, `numpy`, `scipy`, `ffmpeg` and `sox`.
6. **Real-time-safety tools.** Build with RealtimeSanitizer (RTSan, Clang) and the `[[clang::nonblocking]]` attribute on the audio callback to flag malloc, free, locks and syscalls; also ThreadSanitizer and AddressSanitizer builds run through pluginval; Valgrind or `heaptrack` for leaks [5].
7. **Reaper command-line rendering.** `reaper -renderproject project.rpp` with a prepared project renders without interaction in a real DAW; a good way to check a host-loaded plugin deterministically. Reaper's evaluation licence makes it usable on a test machine. Other DAWs (Ableton Live, Logic, Pro Tools, FL Studio, Cubase, Bitwig) are GUI-driven and licensed; treat them as human or device checks, or use UI automation (Windows UI Automation, macOS accessibility, AppleScript) only for narrow, scripted smoke runs.
8. **Plugin GUI screenshots.** Open the editor in the standalone wrapper (the JUCE standalone target) and drive it with OS automation; screenshots at several scale factors and window sizes; compare against baselines. Observe cheaply: crop to the editor window.
9. **Static inspection.** `codesign -dv --verbose=4`, `spctl -a -vv`, `pkgutil --check-signature`, `lipo -archs`, `otool -L` (macOS); `signtool verify /pa`, `dumpbin /dependents` (Windows); `ldd`, `readelf` (Linux); `plutil` for `Info.plist` and AU `AudioComponents`; `moduleinfo.json` for VST3.
10. **Standalone apps.** Treat like desktop apps: UI Automation or accessibility drivers, the audio device APIs through a virtual audio cable (VB-Cable, BlackHole, Loopback, JACK or PipeWire) so tests need no physical interface.

**Can't be driven here:** listening tests (sound quality, aliasing, musicality, feel of controls), licensed and dongled DAWs' GUIs (Pro Tools with AAX and iLok, Logic on macOS only, Cubase with a licence dongle), dropouts on real ASIO and CoreAudio interfaces at low buffer sizes, surround monitoring, real MIDI controllers and control surfaces, AAX signing (needs PACE and Avid developer accounts and an iLok), and Apple notarisation (needs the user's Apple Developer account). These become human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | the primary format on the dev OS: pluginval level 5, a null render against a golden file, load in Reaper (or the standalone) and make sound |
| check | smoke cell, plus the changed parameters and processors, plus pluginval at level 10 |
| full | pairwise over format × OS and arch × host × sample rate × buffer size × channel layout |
| release | every format and OS and arch, every host on the supported list, sample rates 44.1 to 192 kHz, buffers 32 to 2048 plus variable, GUI scales, upgrade from the last version, installers, plus human listening |

Dimensions: format (VST3, AU, AAX, CLAP, standalone); OS and architecture (Windows x64 and arm64, macOS Intel and Apple silicon, Linux); host (Reaper, Ableton Live, Logic, Pro Tools, FL Studio, Cubase, Bitwig, Studio One, Ardour); sample rate (44.1, 48, 88.2, 96, 176.4, 192 kHz); buffer size (32, 64, 128, 256, 512, 1024, 2048, variable, larger than prepared); channel layout (mono, stereo, mono to stereo, sidechain, 5.1, 7.1, Atmos beds, mismatched); real-time or offline render; GUI scale (100%, 125%, 150%, 200%, mixed monitors); instance count (1, 10, 100).

## Check catalogue

### Validation and loading
- [high · auto] Run pluginval at strictness level 5 on every built plugin binary → exit code 0, no failures {smoke}
- [high · auto] Run pluginval at level 10 (or the highest the installed version supports) with `--repeat`, `--randomise` and several `--sample-rates` and `--block-sizes` → passes; failures are triaged with the log, not ignored
- [high · auto] Run `auval -v` on each AU (type, subtype, manufacturer from `Info.plist`) → "AU VALIDATION SUCCEEDED" {smoke}
- [high · auto] Run the Steinberg VST3 validator on each `.vst3` → no failed tests
- [high · auto] Run clap-validator on each `.clap` → all tests pass; state and parameter fuzz tests included
- [high · auto] Verify identifiers: plugin name, manufacturer, unique IDs (VST3 class ID, AU codes, CLAP ID), version, category and bundle metadata → unique, stable between versions, and not clashing with other products; changing the ID later breaks old projects
- [high · agent] Load each format in Reaper (or the standalone) on a clean user profile → scans without being blacklisted; appears under the right vendor, name and category; opens its UI {smoke}
- [medium · auto] Check the binary architecture and dependencies (`lipo -archs`, `dumpbin`, `otool -L`, `ldd`) → each claimed architecture present; no dependency on a library that isn't installed (a Visual C++ runtime, a dylib outside the bundle)
- [medium · agent] Scan with two hosts' scanners at once and with the plugin on a read-only drive or a path with spaces and non-ASCII characters → loads; no crash on scan; scan time is reasonable

### Audio processing correctness
- [high · auto] Null test: render a known input (impulse, sine sweep, noise burst, music clip) through a fixed state and compare to the golden WAV → difference within the stated tolerance (about one 16-bit LSB by pluginval's default); a diff WAV is written on failure {smoke}
- [high · auto] Render the same input at different block sizes (32, 64, 512, 2048 and an odd one such as 480 or 1) and compare → outputs match bit for bit or within tolerance; no block-boundary clicks
- [high · auto] Scan the output for NaN, inf, DC offset, denormals and values over full scale where not intended → none; gain staging matches the documentation
- [high · auto] Feed silence, then a loud burst, then silence; feed full-scale square waves and extreme parameter values → no explosion, hang or runaway feedback; limiter or safety behaves as documented
- [medium · auto] Check the frequency response, THD and dynamic behaviour against the spec (sweeps, `scipy.signal`) → within tolerance of the published values
- [medium · auto] Run at each supported sample rate (44.1 to 192 kHz) and after changing the rate with the plugin loaded → filter coefficients, delay times and tempo-synced values rescale; no pitch or time errors
- [medium · auto] Check oversampling and anti-aliasing paths (on, off, different factors) → latency and tone change as documented; no aliasing above the stated level
- [medium · auto] Mono, stereo, mono-to-stereo, sidechain and surround layouts (as claimed): feed a different tone in each channel → channels land where expected; unsupported layouts are refused cleanly by the host query, not crashed
- [medium · auto] Check bypass: bypass on and off during playback, with and without latency → no click, tail handling documented, latency-matched with the processed path so bypass doesn't shift the timing
- [medium · auto] Check tails: stop the transport on a reverb or delay, and report tail length → tail rings out or is cut as documented; the host gets the right tail length

### Real-time safety and performance
- [high · auto] Build with RTSan or equivalent and run the validator and a render → no allocations, locks or blocking calls in the audio callback; pluginval level 9 reports no allocations during `process` {smoke}
- [high · auto] Run ThreadSanitizer and AddressSanitizer builds through pluginval levels 6 to 8 → no data races on parameters or state; no memory errors
- [high · auto] Measure CPU per instance (render time divided by real time) at 44.1 kHz and 96 kHz and a 64-sample buffer, and with 10 and 100 instances → within the stated budget; scales linearly; no spikes
- [high · auto] Denormal test: feed a decaying signal into silence (reverb tail, filter feedback) and watch CPU → no spike once the signal is tiny; denormals are flushed on the audio thread (including in worker threads)
- [medium · auto] Run for a long soak render (hours of audio) → no memory growth, no crackle, no CPU creep
- [medium · agent] Check the plugin with a variable block size and with a zero-length block, and with blocks bigger than the host announced → no crash; output correct (pluginval level 8 covers larger blocks)
- [medium · agent] Check lazy initialisation and the first-call cost: the first `process` after load and after sample-rate change → no multi-millisecond stall that would cause a dropout
- [medium · agent] Check sample-accurate timing of MIDI and automation inside a block → events land on the right sample; MPE and MIDI 2.0 where claimed

### Parameters, automation and state
- [high · auto] Fuzz all parameters (random values, random order, extremes) while processing → no crash or NaN; values are clamped; the host sees the right ranges, steps, units and names
- [high · auto] Automation: write ramps and steps to each parameter in a rendered project, play back → smooth (no zipper noise) and sample-accurate; the parameter text and value agree; automating while the GUI is open works
- [high · auto] State save and restore: set every parameter and internal state, save, reload (in the plugin, via `getStateInformation`/`setStateInformation`, and via a DAW project) → identical values; the same audio output
- [high · agent] Load a project or preset saved by the previous release (keep a corpus of old state files) → loads with the same sound; a new parameter gets a sensible default; no crash
- [medium · auto] Load corrupted, truncated, empty and future-version state data → no crash; a clear fallback to defaults
- [medium · agent] Presets: load every factory preset, step through them while playing, save and recall user presets, rename and delete → each loads fully, no stuck state or hanging notes; names and categories are right; preset files work across OS
- [medium · agent] Undo and redo in the host after parameter and GUI changes → state matches; gestures begin and end properly (`beginChangeGesture`/`endChangeGesture`)
- [medium · agent] Parameter display: text-to-value entry, units, very large and small values and linked parameters → typing "3 dB" or "100 ms" is parsed; wrong text is rejected cleanly
- [medium · agent] Randomise, A/B and morph features (if any) → no out-of-range values; no clicks

### Latency, transport and host integration
- [high · auto] Impulse alignment: report the plugin's latency in samples, then render an impulse through it in a host (or harness) with plugin delay compensation → the impulse is time-aligned with the dry track within one sample after compensation
- [medium · auto] Change the latency while running (switch oversampling or lookahead on) → the host is told, compensation updates, and no glitch beyond the documented one
- [medium · agent] Transport sync: tempo, time signature, loop, jump and play position; free-running and tempo-synced LFOs and delays across tempo changes → phase and timing follow the host; no drift over a long loop
- [medium · auto] Offline versus real-time render: bounce the same project both ways → outputs match; `isNonRealtime` is honoured (quality may be higher offline, but must not change the sound unexpectedly)
- [medium · agent] Freeze, bounce, track duplicate, track disable and enable, and offline processing in the host → plugin keeps state and doesn't leak or crash
- [medium · agent] Multiple instances: ten to a hundred instances, with different states, in a session, and with shared resources (samples, wavetables, licence) → each keeps its own state; memory per instance is reasonable; no static shared variables causing cross-talk
- [medium · agent] Load the plugin on a different thread or in a sandboxed host (a bridged 32/64 or out-of-process plugin host) → works; no thread-affinity assumptions
- [medium · agent] Instruments: polyphony limits, voice stealing, note-off and sustain-pedal handling, all-notes-off on stop, pitch bend range, MPE → no stuck notes; correct voice limits; tuning and microtonal data right

### GUI, scaling and usability
- [high · agent] Open and close the editor 100 times, resize it, open it while audio plays, and close the host with it open → no crash, leak, freeze or audio dropout (pluginval levels 4 and 6 cover parts of this)
- [high · agent] HiDPI and scaling: 100%, 125%, 150%, 200% on Windows, Retina on macOS, and a window dragged between monitors of different scale → crisp, correctly sized, hit areas correct; no blurry or tiny UI; resizing keeps the aspect or layout rules
- [medium · agent] Check the GUI with the keyboard and mouse: tab order, text entry fields keep focus, host keyboard shortcuts (space for play) still work or are intentionally captured, mouse wheel and fine-adjust (shift or ctrl drag) and double-click to reset → predictable; works in each host
- [medium · agent] Check that the UI reflects automation and host-side changes live → knobs move; no stale values after preset load
- [medium · agent] Check contrast, text size and colour use of the UI and any screen reader or keyboard support the plugin claims → readable; unlabelled controls are noted {a11y}
- [low · agent] Check the editor in a plugin window of every host (floating, docked, inside a track, tiny) → layout holds
- [medium · agent] Parameter and tooltip text, error and licence dialogs → accurate, spelled right, no placeholder text

### Hosts, formats and platforms
- [high · agent] Load in each host on the supported list (Reaper, Ableton Live, Logic Pro, Pro Tools, FL Studio, Cubase, Bitwig, Studio One), save and reopen a project → loads, plays, automates and recalls state; record each host's result in the matrix (device and human where licences apply)
- [medium · agent] Check the format-specific behaviour: VST3 parameter flush and sidechain; AU `AUv2` versus `AUv3` and presets in Logic's library; AAX in Pro Tools with its own bus rules, DSP versus Native, and delay compensation; CLAP polyphonic modulation and note expressions → each uses format features correctly
- [medium · device] Apple silicon: load in a host running natively and under Rosetta; Windows on ARM if claimed → works in both; architecture mismatch gives a clear scan message not a crash
- [medium · agent] Install into the standard folders (VST3, Components, AAX, CLAP, user and system) and uninstall → files land in the right places; uninstall removes all; presets and licences are in the documented places
- [medium · agent] Install while a host is running, and install an update over an old version → host asks to restart or rescan; no duplicate plugins; settings survive
- [medium · auto] Check codesigning and notarisation on macOS (`codesign`, `spctl`, `stapler validate`) and signing on Windows (`signtool verify /pa`) of the installer and each binary → valid, trusted signature; no Gatekeeper or SmartScreen block on a clean machine {security}
- [medium · agent] Standalone app: audio device selection, sample rate and buffer change, device removal during playback, MIDI device hot-plug, and device lists with no inputs → handles changes with a message and no crash

### Licensing, activation and safety
- [high · agent] Fresh install, activate with a test licence, deactivate, reactivate, use offline, use on a second machine, and expire a trial (test mode, test accounts, set the system clock back only in a VM) → each behaves as documented; no real keys or payments
- [medium · agent] Check the unlicensed and expired behaviour (demo mode, silence bursts, nag) → clear message; project and presets stay safe; no data loss and no crash during playback
- [high · agent] Check that the activation flow and any network call don't block the audio or UI thread, and that offline use is graceful → no dropout when the server is down {security}
- [medium · agent] Check for stored license data and personal data (machine IDs, emails) and privacy disclosure → minimal; redacted in logs {security}
- [medium · agent] Check output volume safety: a feedback loop or a bad parameter can't send a full-scale burst without a limiter or warning where the product claims it → safe by default

## Gates

Format validation and signing: see `../gates/audio-plugin-validation.md`. Block release when:

- pluginval fails at level 5 (aim for level 10), or `auval`, the VST3 validator or clap-validator fails.
- A null or golden render differs beyond tolerance, or output contains NaN or inf.
- The plugin allocates or locks in the audio callback.
- State or presets from the previous release don't load.
- Latency reported to the host is wrong (impulse not aligned after compensation).
- A crash on open, close, scan or project load in any host on the supported list.
- Installers or binaries are unsigned or fail Gatekeeper or SmartScreen on a clean machine.

## Human-only checks

- [human] Listen on good headphones and speakers to the plugin across its range, at several sample rates and buffer sizes → sounds right; no clicks, zipper noise, aliasing, harshness or level jumps.
- [human] Use it in a real session in each host you support for 30 minutes, including save, close, reopen and bounce → nothing feels broken or slow; the GUI feels responsive.
- [human] Run it at low buffer sizes on a real audio interface (ASIO or CoreAudio) with other plugins → no dropouts at the stated CPU load.
- [human] In Pro Tools (with a developer-signed AAX and an iLok), test load, automation, delay compensation and AudioSuite if supported → works. (Needs the developer account, hardware and licence.)
- [human] Judge presets, names, GUI design, manual and install experience → good enough to ship under your name.
- [human] Test surround or Atmos layouts on a real monitoring chain if claimed → channels are correct.
- [human] Notarise, sign and upload through your own accounts (Apple Developer, PACE, a code-signing certificate) and test the installers on clean machines → they install and load without warnings. (Agents never handle certificates.)

## Known pitfalls

- **pluginval version differences.** Strictness-level contents and flags vary between releases and the develop branch; check `pluginval --help` and record the version. Don't claim "level 10 passed" without it.
- **pluginval GUI tests need a display.** In headless CI use `--skip-gui-tests` and note that GUI checks were skipped.
- **AU cache.** A new AU may not show or may show old data until the AU cache is cleared or `auval -a` is rerun; reinstall before reporting a missing plugin.
- **Hosts blacklist plugins** after one crash during scan. Clear the host's blacklist before retesting; don't report "plugin missing" until you have.
- **Intentional differences between hosts** (parameter display, how a host handles latency or bypass, default window size, how it reports tails) aren't plugin bugs; check the host's own documentation.
- **Nulls aren't expected** across different sample rates, oversampling settings, plugin versions or when randomness (unseeded noise, unison detune) is intended. Seed the randomness, or compare spectra, not samples.
- **Denormals and CPU in debug builds** or without CPU flush-to-zero flags look worse than a release build; measure the release build.
- **Optimised builds can hide asserts**, and debug builds can hide timing bugs. Run both for sanitisers and a release build for CPU numbers.
- **Anti-virus and Gatekeeper** can slow or block the first scan of an unsigned build; fix signing, don't file a bug against the plugin's code.
- **Offline render quality differences** (higher oversampling when `isNonRealtime`) are by design when documented.
- **Floating-point differences across CPU architectures** (x64 versus arm64, with or without FMA) produce tiny sample differences; compare with a tolerance, not exactly.
- **Don't ask the user to share licence keys.** Use test licences or ask the user to run licence checks.

## Sources

1. [pluginval (Tracktion)](https://github.com/Tracktion/pluginval) — strictness levels 1 to 10, flags, acceptance mode and `--rtcheck` on the develop branch (checked 2026-11-16)
2. [Apple: validating Audio Units (`auval`)](https://developer.apple.com/library/archive/technotes/tn2312/_index.html) — `auval` usage for Audio Units (checked 2026-11-16)
3. [Steinberg VST 3 developer portal: validator](https://steinbergmedia.github.io/vst3_dev_portal/pages/What+is+the+VST+3+SDK/Validator.html) — command-line VST3 validator (checked 2026-11-16)
4. [clap-validator](https://github.com/free-audio/clap-validator) — out-of-process CLAP tests, state and parameter fuzzing (checked 2026-11-16)
5. [LLVM: RealtimeSanitizer](https://clang.llvm.org/docs/RealtimeSanitizer.html) — flags malloc, free and locks in `[[clang::nonblocking]]` code (checked 2026-11-16)
6. [JUCE: AudioProcessor class reference](https://docs.juce.com/master/classjuce_1_1AudioProcessor.html) — variable block sizes, `isNonRealtime`, latency and tail reporting (checked 2026-11-16)
7. [pluginval: acceptance testing](https://github.com/Tracktion/pluginval/blob/develop/docs/Acceptance%20testing.md) — golden-file comparison, 16-bit LSB tolerance, NaN and inf fail (checked 2026-11-16)
8. [JUCE forum: denormal prevention](https://forum.juce.com/t/state-of-the-art-denormal-prevention/16802) — `ScopedNoDenormals` per thread; forum evidence (checked 2026-11-16)
9. [Avid AAX SDK documentation](https://learn-cdn.avid.com/AAX_SDK_2p1p1/Documentation/Doxygen/output/html/a00274.html) — signing for released Pro Tools; old page, current details under NDA (checked 2026-11-16)
10. [Spotify Pedalboard](https://github.com/spotify/pedalboard) — loading VST3 and AU plugins from Python for automated rendering (checked 2026-11-16)
