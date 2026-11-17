---
module: games
kind: platform
title: Games (PC, console, mobile, web; Unity, Unreal, Godot, web engines)
checked: 2026-11-16
---
# Games

Covers video games on PC, console, mobile and the web, built with Unity, Unreal, Godot, or web engines (Phaser, three.js, Babylon.js, PlayCanvas) or a custom engine. It covers the core loop, saves, input, performance, settings, audio, localisation, accessibility, suspend and resume, multiplayer basics, soak runs and the build-intake and milestone practices of game QA. Much of "feel" (fun, difficulty, game feel, audio mix) is a human judgement, and this module says so. It goes with `ios.md` or `android.md` for mobile, `windows-desktop.md` for PC, `xr.md` for VR, `../features/accessibility.md`, `../features/i18n-rtl.md`, `../features/performance.md`, `../features/payments-subscriptions.md` for in-app purchases (test mode only), and the gates `../gates/steam.md`, `../gates/xbox.md`, `../gates/playstation-nintendo.md` and `../gates/age-ratings.md`.

## Signals

- Unity: `ProjectSettings/`, `Assets/`, `Packages/manifest.json`, `*.unity` scenes. Unreal: `*.uproject`, `Config/DefaultEngine.ini`, `Source/`. Godot: `project.godot`, `*.tscn`, `*.gd`. Web: `phaser`, `three`, `babylonjs`, `playcanvas`, `pixi.js` in `package.json` plus a canvas.
- Steam files (`steam_appid.txt`, Steamworks SDK), console SDK folders, `GameActivity` in Android, `Info.plist` with game controller keys.
- README or store words: "game", "levels", "controller support", "achievements", "multiplayer".

## Kickoff questions

1. Which platforms and engine versions ship, and what is the minimum spec you promise? (best guess: Windows PC on the current engine; no console; minimum spec = the oldest machine the user has)
2. Is there online play, accounts, cloud saves or in-app purchases? (best guess: read the code; if no, skip multiplayer and purchase checks)
3. What do you have for builds and test hardware: a packaged build, a debug build, a test controller, a low-end PC or phone? (best guess: a packaged build, no console devkits, one controller if available)

## Drivers

Best and cheapest first. Games render to a canvas or window, so accessibility trees rarely help; logs, engine tests and screenshots do.

1. **Engine test frameworks.** Unity Test Framework (Edit Mode and Play Mode tests, run with `-runTests -batchmode`), Unreal Automation System (`-ExecCmds="Automation RunTests ..."`, Gauntlet for session-based and multi-client runs), Godot with GUT (`gut_cmdln.gd` in headless mode) or GdUnit4. These run deterministic logic, save round-trips, data validation and simple scripted playthroughs [1][2][3].
2. **Build-time validators and logs.** Engine build logs, missing-asset and shader warnings, `Player.log` or `Editor.log` (Unity), `Saved/Logs/*.log` (Unreal), Godot's console output; search for errors, `NullReference`, "missing", "failed to load". Crash dump collection through the engine's crash reporter.
3. **Scripted bots and input injection.** A debug-menu or console command set (`stat fps`, `god`, "skip level"), automated playthrough bots, and recorded input playback. For black-box builds, send OS input (SendInput on Windows, `xdotool` on Linux, `adb shell input`, `xcrun simctl` limited) and watch the log and screenshots.
4. **Performance capture.** Frame times per frame, not averages: Unity Profiler and Frame Timing Manager, Unreal `stat unit`, Unreal Insights, `-benchmark`; PresentMon (Windows) and MangoHud (Linux) for any build; RenderDoc or PIX for frame captures; Android `dumpsys gfxinfo` and Perfetto; Xcode Instruments. Record 99th percentile frame time, hitch counts, memory over time.
5. **Network emulation.** Unreal's `NetEmulation` (`PktLag`, `PktLoss`, `PktDup`, `PktOrder`); on any engine, clumsy (Windows), `tc netem` (Linux) or Network Link Conditioner (macOS) against a local or private server [4].
6. **Screenshots at fixed resolutions** for UI overflow, safe areas, aspect ratio and localisation; a pseudo-locale or a long-string pass finds truncation fast [5]. Screenshots at 1280×800 or less to save cost; capture the full-size ones to disk and read only the crops that matter.
7. **Web games.** Playwright with a canvas; read game state through a debug hook (`window.__game`) the build exposes, since the canvas has no DOM; use the browser's performance tools and `requestAnimationFrame` timing.
8. **Computer use** only as a last resort for menus a bot can't reach.

**Can't be driven here:** game feel, fun, difficulty, readability under motion, audio mix and music, haptics and adaptive triggers, motion sickness, real controllers' hot-plug, console devkit behaviour (suspend, user switching, storage), certification submission and any platform's review, rating bodies. Console requirements are mostly under NDA: the user brings the checklist (`../gates/playstation-nintendo.md`, `byo.md`). Agents never mark these passed.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | packaged build on the primary platform at default settings: launch, menu, start a new game, play the first minutes, save, quit, load |
| check | smoke cell, plus the changed systems and levels, plus a save made by the previous build |
| full | pairwise over platform × spec tier × input device × resolution and aspect ratio × language × graphics preset × online or offline |
| release | every platform and spec tier, every input device, full playthrough, all languages, soak run, certification pre-checks, human checks |

Dimensions: platform and OS version; spec tier (minimum, recommended, high); GPU vendor; handheld (Steam Deck) or desktop; input (keyboard and mouse, Xbox, PlayStation and Switch controllers, touch, remapped); resolution (720p to 4K, 16:9, 16:10, 21:9, 32:9, portrait, notch and safe areas); refresh rate and VRR; HDR; graphics preset; language; audio output (stereo, headphones, surround); network (online, offline, lag, loss); account state (signed in, guest, offline mode); save state (new, old build, corrupted, cloud).

## Check catalogue

### Build intake and stability
- [high · auto] Verify the build: version number, build ID, timestamps, file list, language and region files, and package integrity (checksums, CRCs) against the build notes → everything matches; no files from another build or language. This is the build verification test (BVT) [6] {smoke}
- [high · agent] Build acceptance: launch, reach the main menu, start a new game and play the first few minutes (build acceptance test, BAT) → no crash or hang; if this fails the build is rejected and nothing else runs {smoke}
- [high · auto] Run engine tests and any bot playthrough (Unity Test Framework, Unreal Automation, GUT) → they pass or failures are recorded as the baseline {smoke}
- [high · agent] Play every level or area start to finish at default settings, with logs on → completes with no crash, soft lock or progression blocker; log has no new errors
- [medium · agent] Check the log and crash reporter after each session → no unhandled exceptions, missing assets, shader failures or assertion messages
- [medium · auto] Check the build size, install size and first-run download against the store listing → within stated sizes; no leftover debug content, cheat menus or test levels reachable by players {security}
- [high · auto] Search the shipped build for debug flags, developer consoles, test accounts, API keys and server addresses → none in a release build, or the console is gated {security}

### Core loop and progression
- [high · agent] Play the core loop repeatedly (the main action, reward, upgrade) for 30 minutes of play → the loop works every time; rewards and costs add up; no exploit loops that bypass the intended economy
- [high · agent] Try to break progression: skip tutorial steps, go back, sequence-break, use abilities in odd places, leave areas early, die at scripted moments → no soft lock, missing trigger or unreachable end; respawn and checkpoints put the player in a playable state
- [high · agent] Reach and finish the tutorial and the first-time user flow with no prior knowledge → every prompt is understood and shown for the active input device; nothing refers to a button that doesn't exist
- [medium · agent] Check collision, clipping and out-of-bounds in each level (walk, jump and dash at walls, edges, doors, moving platforms) → the player can't leave the map or get stuck; falling out of the world recovers
- [medium · agent] Check difficulty modes, scaling and fail states → each mode is selectable, saves separately if designed to, and enemies and timers match their descriptions
- [medium · agent] Check game economy and unlocks (currency, items, achievements, XP) across a long session → values never go negative or overflow; unlock conditions match their text
- [medium · agent] Pause during every kind of scene (cutscene, boss, loading, dialogue, minigame) → pause works or is deliberately disabled; resume continues exactly; timers and physics don't run during pause
- [medium · agent] Skip, fast-forward and replay cutscenes and dialogue → skipping never breaks the state; subtitles and audio stay in sync

### Saves and data
- [high · agent] Save, quit, relaunch and load in every slot, at every save type (manual, autosave, checkpoint) → the exact state returns (position, inventory, quest flags, settings, time) {smoke}
- [high · auto] Kill the process during a save (power-loss simulation), fill the disk, remove the save folder's write access and delete a save file → no corrupted loaded state; the game reports the error, keeps the last good save (backup or atomic write), and doesn't crash on load
- [high · agent] Load a save made by the previous build, an older save and a hand-edited one with out-of-range values → migrated or refused with a clear message; no crash; no lost progress
- [medium · agent] Create the maximum number of saves, and very long play time saves → slots list correctly; save time and file size stay reasonable
- [medium · agent] Use a second user profile or OS account → saves are separate; no cross-profile overwrite
- [high · device] Cloud saves (Steam Cloud, console cloud, platform cloud): save on device A, load on device B, create a conflict by playing offline on both → latest-or-chosen save is kept, with a conflict prompt; no silent overwrite
- [medium · agent] Check settings persistence (graphics, audio, controls, language) across restart and across a reinstall → persists where expected; reset to defaults works
- [medium · agent] Check save data privacy → no secrets or personal data stored in plain text in save files {security}

### Input
- [high · agent] Play the full loop with keyboard and mouse only, and with each supported controller only → every action, menu and prompt works with each device alone {smoke}
- [high · agent] Hot-plug and unplug a controller, switch devices mid-game, connect two controllers → prompts and glyphs switch to the active device (keyboard, Xbox, PlayStation, Switch); the game pauses on disconnect where required; no ghost input
- [high · agent] Open the remapping screen, remap every action including conflicts, reset to defaults, restart → bindings apply, conflicts are reported, and they survive restart; rebinding menu works with each device {a11y}
- [medium · agent] Hold, tap, double-tap, chorded and simultaneous inputs, and mashing every button at once in menus and gameplay → no stuck input, double triggers or crashes
- [medium · agent] Check mouse behaviour: raw input, sensitivity, inversion, cursor lock and release on alt-tab, multi-monitor edge, cursor visibility in menus → cursor never trapped or lost
- [medium · agent] Check analog sticks and triggers: dead zones, drift handling, response curve, left-handed layouts, vibration on and off → controls feel consistent; settings apply
- [medium · agent] Touch games: multi-touch, palm rejection, gesture conflicts with OS edge swipes, small screens and large tablets → tap targets large enough; no accidental system gestures
- [medium · agent] Text input: on-screen keyboard (Steam Deck, console), IME, copy and paste, name entry with emoji and profanity filter → text accepted or refused clearly; the keyboard opens automatically on handheld
- [medium · agent] Alt-tab, minimise, lose focus and regain focus, open the overlay (Steam, Xbox Game Bar, Discord) → game pauses or continues as designed; no stuck keys; no crash on return

### Performance and frame pacing
- [high · auto] Capture frame times on the minimum-spec machine during the heaviest scene at default settings for 5 minutes → meets the target (30 or 60 fps as promised) at the 99th percentile, with no hitches over a few frames; record numbers, not impressions
- [high · auto] Check frame pacing (even frame times), not only average fps, with vsync on and off, VRR and capped refresh → no judder pattern (alternating long and short frames); the frame cap setting works
- [medium · auto] Measure load times (boot, level load, fast travel) and memory on min spec → within the stated or reasonable limits; no unbounded growth
- [medium · auto] Run the graphics presets (low to ultra) and resolution scaling (DLSS, FSR, TAA options) → each preset applies, lower presets are faster, and no preset has missing effects or black textures
- [medium · agent] Run in windowed, borderless and exclusive fullscreen, and change resolution and refresh rate at runtime, then alt-tab → mode switches cleanly; no stuck resolution after a crash
- [medium · agent] Laptop and handheld: run on battery with power saver, and on Steam Deck at its native resolution → stays playable; thermals don't throttle within a normal session
- [medium · agent] Shader compilation: first run with an empty shader cache → stutter is acceptable and disclosed, or precompiled; no black frames
- [medium · auto] Check CPU and GPU usage in menus and when paused → no 100% GPU in a static menu; the fan doesn't spin up for a pause screen

### Display, UI and resolution
- [high · agent] Run at 1280×720, 1920×1080, 2560×1440, 3840×2160, 16:10, 21:9, 32:9 and portrait (if supported); capture screenshots of menu and HUD → UI scales; HUD in safe areas; no stretched art, cut-off buttons or black bars where there shouldn't be {smoke}
- [medium · agent] Check UI scale, text size and HUD options → at the largest setting, text still fits; the smallest text stays legible at 1280×800 (Steam Deck's handheld view) [7] {a11y}
- [medium · agent] Check mobile notches, rounded corners, foldables, split view and rotation → UI stays inside safe areas; rotation lock respected; no restart on rotation
- [medium · agent] Multi-monitor and DPI changes at runtime (drag to a monitor with another scale) → the game adapts or stays correct; no crash
- [medium · agent] HDR on and off, brightness and gamma calibration screen → image looks right; the calibration works; no clipped menus
- [low · agent] Check loading screens, logos and tips → no overlapping text, no missing art, no spinner forever

### Audio
- [high · agent] Play with audio devices: speakers, headphones, hot-swap headphones, Bluetooth, no device, device removed mid-game, sample-rate changes → audio follows the device; no crash or silence after a switch
- [medium · agent] Check the volume sliders (master, music, SFX, voice), mute, and mute when unfocused → each changes only its bus; levels are saved; muting really mutes
- [medium · agent] Play long sessions and many simultaneous sounds → no cut-outs, crackle, missing voices or growing latency; voice lines don't overlap unintentionally
- [medium · agent] Check lip-sync, cutscene audio and subtitle timing → in sync after pause, skip and load
- [medium · agent] Suspend and resume audio on phone call, notification and app switch (mobile) → audio pauses and resumes; no stuck loop
- [medium · human] Judge the mix: music against voice against effects, loudness consistency between scenes, and any harsh sounds → balanced and comfortable at normal volume

### Localisation
- [high · agent] Switch to each shipped language (menu, in-game, subtitles) and capture screenshots of the longest strings → no truncation, overlap, untranslated or raw string IDs, "TODO" text or literal placeholders (`{0}`, `%s`); missing glyphs for CJK, Cyrillic, Arabic or Thai show real characters [5]
- [medium · agent] Use a pseudo-locale or deliberately long strings in the strings table → layout holds or text scales; find truncation before translation arrives [8]
- [medium · agent] Right-to-left languages (if shipped) → text direction, UI mirroring, number and punctuation order correct
- [medium · agent] Regional formats: dates, numbers, currency, units, gendered or plural text, and platform-specific terms → correct per language; button names match the platform's own (A/B, Cross/Circle)
- [medium · agent] Voice-over and subtitles: language selection separate for audio and text, subtitles match the audio, speaker names correct → each combination works
- [low · human] Have a native speaker review a sample of the text and voice → natural, accurate, culturally fine

### Accessibility
- [high · agent] Subtitles: on by default or prompted at start, size, background and speaker names, for dialogue and key sound cues → readable against any background {a11y}
- [high · agent] Colour-blind modes and colour reliance: check each mode on UI and gameplay-critical cues with a simulator (screenshots through a colour-blindness filter) → no information is conveyed by colour alone; modes change the right elements {a11y}
- [high · agent] Full remapping, hold-versus-toggle options, one-handed layouts, auto-aim and assist options, adjustable timers and difficulty → options exist for each, work and persist {a11y}
- [medium · agent] Check flashing and motion: screen shake, camera bob, motion blur, flashing lights, field of view options → can be turned off or reduced; no content above the photosensitivity thresholds without a warning {a11y}
- [medium · agent] Check text-to-speech or screen-reader support for menus (where supported by the platform) → menus are navigable and read in order {a11y}
- [medium · human] Play with assistive settings on (one-handed, high contrast, large text) for 20 minutes → is the game still completable and enjoyable? {a11y}

### Suspend, resume and interruptions
- [high · device] Suspend and resume the game (console quick resume, Steam Deck sleep, phone home button, laptop lid close) at menu, mid-level, during save and during loading → resumes in the same state; no crash, lost save or broken network session
- [high · agent] Lose and restore the network while playing offline-capable and online modes → graceful message; play continues where promised; no data loss
- [medium · device] Handle user switching, sign-out and account change, storage removal and low-storage warnings (console) → game reacts as the platform requires; saves belong to the right user
- [medium · agent] Mobile: incoming call, notification, low battery, airplane mode, background for an hour, kill by the OS and relaunch → state kept or restored; no black screen on return
- [medium · agent] Check controller disconnect during a cutscene, loading and a pause → game pauses or handles it; reconnection works

### Multiplayer and online
- [high · auto] Emulate latency, jitter, packet loss, duplication and reordering (netem, Unreal `NetEmulation`, clumsy) against the test server → gameplay degrades gracefully (prediction, interpolation); no desync that stays, no crash; the lag indicator is truthful
- [high · agent] Disconnect and reconnect a player mid-match, drop the host, kick a player, and let the match end during a disconnect → the match continues, ends or migrates as designed; progress and rewards are not lost or duplicated
- [high · agent] Matchmaking and lobbies: queue, cancel, party invite, full lobby, ready-up timeout and joining mid-session where allowed → one outcome each; no ghost lobbies
- [medium · agent] Check anti-cheat and server authority basics: send out-of-range values and replay commands from a modified test client against a private server → the server rejects impossible actions; no client-trusted currency, health or position {security}
- [medium · agent] Chat and user-generated content: filters, report and block, moderation hooks → work as described; platform rules for UGC are covered
- [medium · agent] Two clients with different languages, input devices and platforms (crossplay) → behaves the same; names, text and voice chat work
- [medium · agent] Check leaderboards, achievements, stats and cloud profile after multiplayer matches → updated once; no double awards

### Achievements, store features and purchases
- [high · agent] Unlock each achievement through play or a test flag (list from the design doc) → unlocks once, shows the right text and icon, and syncs to the platform's test profile; none are missable without a warning, none are impossible
- [high · agent] In-app purchases and DLC in sandbox or test mode only: buy, cancel, restore, refund path and offline state → entitlements arrive once and persist; never with real money
- [medium · agent] Platform overlays and features (friends, invites, rich presence, screenshots, controller glyphs from the platform) → work with the platform's test setup
- [medium · agent] Parental controls, age gates and ratings display (shown where required) → work; consistent with the rating questionnaire answers (see `../gates/age-ratings.md`)

### Soak and long runs
- [high · auto] Soak run: leave the game running (an idle loop and an automated play loop) for 8 hours or more with memory and frame time logging → no memory growth trend, no frame drift, no crashes; data saved at intervals is still valid
- [medium · auto] Repeat a load-level-quit cycle 100 times → memory returns to baseline; load time doesn't grow; no handle or file leaks
- [medium · agent] Play across midnight, a time-zone change, a clock set backwards and forwards (daily rewards, timers, events) → no free rewards from clock cheating where it matters; no crash {security}

## Gates

Store and console submission is human and often under NDA. Console builds are certified on retail hardware, a failed item needs a new build and slot, and day-one patches are certified too [10][11]. Link the gate packs: `../gates/steam.md` (Steam release checklist and Steam Deck Verified), `../gates/xbox.md` (Xbox requirements and certification), `../gates/playstation-nintendo.md` (bring your own checklist), `../gates/age-ratings.md` (IARC, ESRB, PEGI). Block release when:

- Any open crash, hang, data-loss or progression-blocking bug (class A in game QA) [6].
- Saves can corrupt or be lost, or an older save fails to load.
- The minimum spec doesn't hold its stated frame rate.
- Any promised input device, language or platform feature is missing.
- Debug content, cheat consoles or keys ship in the release build.
- The release-candidate pass isn't complete on every platform being shipped.

## Human-only checks

- [human] Play the first 30 minutes as a new player, without help → is it fun, clear and fair? Where did you stop caring or get lost?
- [human] Play a full session on each target platform and input device → controls feel right, the camera is comfortable, difficulty is fair.
- [human] Listen on speakers and headphones → music, voice and effects balanced; nothing painful or repetitive.
- [human] Check for motion sickness and eye strain in 3D and fast-camera games, especially VR → comfortable for 20 minutes.
- [human] Play on real hardware: console devkits, a phone, the Steam Deck, a low-end PC, with a controller you plug in yourself → performs and feels as designed.
- [human] Run the console submission or Steam release yourself with your accounts and the NDA checklists → accepted. (Agents never submit or pass certification.)
- [human] Review the store page, screenshots, trailer and age-rating answers against the build → accurate.

## Known pitfalls

- **Editor results aren't build results.** Behaviour, performance and shaders in the editor differ from a packaged build. Test the packaged build and say which you used.
- **Average fps hides the problem.** Report 99th percentile frame time and hitches, not the mean. A 60 fps average with 100 ms hitches is a bug.
- **Debug builds are slow.** Don't report performance from a development or debug build against the minimum-spec target.
- **First-run shader and asset caching** causes one-time stutters; reproduce on the second run before filing.
- **Unity and Unreal editor warnings** (deprecated APIs, "obsolete", asset import messages) are noise unless they appear in a player build log.
- **Streaming and screen-recording tools** and overlays (Steam, Discord, GPU overlays) change frame pacing. Test with them off, then on.
- **Gamepad glyph differences** between Xbox, PlayStation and Switch layouts are by design; check that they match the active device, not that all look the same.
- **Anti-cheat, DRM and launchers** can block automation and block under a debugger. This is a setup limit, not a bug.
- **Difficulty and balance feedback isn't a defect.** QA finds bugs; playtesting and user research judge fun and difficulty. Mark those as observations for a human [9].
- **Platform requirement numbers differ by platform and change.** Don't quote a requirement without a current source; Sony and Nintendo requirements are under NDA.
- **Soak runs on a laptop** can fail from sleep or updates, not from the game. Disable sleep and updates first.

## Sources

1. [Unity Test Framework](https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/index.html) — Edit Mode and Play Mode tests, batch mode (checked 2026-11-16)
2. [Unreal Engine: Automation System and Gauntlet](https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-system-in-unreal-engine) — automation tests and session-based runs (checked 2026-11-16)
3. [GUT: Godot Unit Test](https://github.com/bitwes/Gut) — Godot test framework with command-line runner (checked 2026-11-16)
4. [Epic: using network emulation in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/using-network-emulation-in-unreal-engine) — `PktLag`, `PktLoss`, `PktDup`, `PktOrder` (checked 2026-11-16)
5. [Meta: testing localization](https://developers.meta.com/horizon/resources/testing-localization/) — truncation, overlap, untranslated strings, raw string IDs, placeholders, missing glyphs, RTL (checked 2026-11-16)
6. [Microsoft: build verification testing (BVT)](https://learn.microsoft.com/en-us/archive/blogs/imtesty/build-verification-testing-bvt) — BAT versus BVT; version, timestamp, CRC, language checks (checked 2026-11-16); and [Game Developer: the QA pipeline](https://www.gamedeveloper.com/production/introducing-the-quality-assurance-pipeline) — bug classes A to D and the find, report, assign, fix, regress cycle (checked 2026-11-16)
7. [Steamworks: Steam Deck compatibility](https://partner.steamgames.com/doc/steamdeck/compat) — controller, glyph, on-screen keyboard, text size and performance criteria (checked 2026-11-16)
8. [Microsoft: pseudolocalization](https://learn.microsoft.com/globalization/methodology/pseudolocalization) — pseudo-locales to find overflow early (checked 2026-11-16)
9. [Games User Research: user testing in the development process](https://gamesuserresearch.com/how-to-build-user-testing-into-your-development-process-from-concept-to-release/) — QA finds bugs; user research gathers experience feedback (checked 2026-11-16)
10. [Microsoft: Xbox certification requirements](https://learn.microsoft.com/en-us/gaming/gdk/docs/store/policies/console/certification-requirements) — numbered requirements and final testing on retail hardware (checked 2026-11-16)
11. [Game Informer: console certification (Vlambeer)](https://gameinformer.com/b/news/archive/2016/08/07/vlambeer-s-rami-ismail-speaks-out-about-mysterious-console-certification-process) — certification timing, day-one patches also certified (checked 2026-11-16)
