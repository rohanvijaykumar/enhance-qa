---
module: xr
kind: platform
title: AR, VR and XR (Quest, Apple Vision Pro, WebXR)
checked: 2026-11-16
---
# AR, VR and XR

Covers immersive apps on Meta Quest (standalone and PC link), Apple Vision Pro (visionOS), other headsets (SteamVR, Pico) and WebXR in a browser. Comfort, frame rate, tracking and boundaries matter more than anywhere else, and most of these checks need a headset and a human. An agent can run simulators, log and performance capture and the non-immersive parts. It goes with `games.md` for game structure (saves, input, progression), `android.md` (Quest apps are Android apps), `ios.md` (visionOS shares Apple tooling), `web-app.md` for WebXR, `../features/accessibility.md` and `../features/camera-mic-sensors.md`. Platform store rules differ and change; read each store's current guidelines (sources) and the client's checklist (`byo.md`).

## Signals

- Unity with XR Interaction Toolkit, OpenXR, Meta XR SDK or AR Foundation; Unreal with OpenXR; Godot with the OpenXR plugin; Apple projects with `visionOS` targets, RealityKit and `ImmersiveSpace`; web projects with `three`, `babylonjs`, `A-Frame` and `navigator.xr`.
- Android manifest with `com.oculus.*` features, `headtracking` or `oculus.software.handtracking`; `.visionproj`.
- README words: "VR", "AR", "mixed reality", "passthrough", "hand tracking", "Quest", "Vision Pro", "WebXR".

## Kickoff questions

1. Which devices and runtimes must be supported, and is a headset available to test on? (best guess: Quest 3 plus the Meta XR Simulator; no headset available means every device check goes to the user)
2. How do players move and interact: teleport, smooth locomotion, room-scale, seated, hands, controllers, gaze? (best guess: read the locomotion and input code)
3. Is it a game, a productivity or enterprise app, or an experience: how long is a typical session? (best guess: a game with 30 to 60 minute sessions; this changes comfort and soak checks)

## Drivers

1. **Project tests and engine test frameworks.** Unity Test Framework, Unreal Automation, Godot GUT for logic, state machines and data. Run first; record the baseline (see `games.md`).
2. **Simulators and emulators.**
   - **Meta XR Simulator** runs OpenXR apps on a PC without a headset, simulating the headset, controllers and some inputs. Good for flow and logic, not for comfort or real tracking [1].
   - **visionOS Simulator** in Xcode (macOS only) shows the app in a simulated space with gaze and gesture simulation; good for layout and flow, not for real hand and eye behaviour or performance [2].
   - **Immersive Web Emulator** (Meta's WebXR emulator extension, a successor to the WebXR API Emulator) emulates headsets and controllers in a desktop browser for WebXR; Playwright can load it in Chromium with the extension [3].
3. **Performance capture.** Meta Quest: OVR Metrics Tool on device (frame rate, stale frames, CPU and GPU level, memory, thermals), the Meta Quest Developer Hub, RenderDoc for Meta, `adb logcat`, Perfetto, Unity Profiler and Unreal Insights. Apple: Instruments (RealityKit and GPU templates), Xcode's Reality Composer Pro. PC VR: Fpsvr or the SteamVR frame-timing graph, PresentMon. Record dropped frames, not average fps [4].
4. **`adb` and device logs.** For Quest: `adb install`, `adb shell`, `adb logcat`, screen capture (`scrcpy` mirrors; the mirror isn't what the user sees), `adb shell am start`. The headset must be put in developer mode by its owner (human).
5. **WebXR in the browser.** Playwright with a local HTTPS server (WebXR needs a secure context), the emulator extension, and a debug hook that exposes the session state; assertions on `navigator.xr.isSessionSupported`, session start and end, and feature requests.
6. **Static checks.** Manifest and entitlement review (permissions for hand tracking, passthrough, spatial data, eye tracking and camera access), store-policy checklists, `aapt dump badging` for Quest APKs, `plutil` for Apple entitlements.
7. **Screenshots and recordings** captured by the platform's capture tool, at modest size; use them for text-legibility and UI layout checks, remembering that a flat capture doesn't show depth or comfort.

**Can't be driven here:** everything about how it feels in a headset: motion sickness and comfort, depth and scale, text legibility at real distance, tracking quality in different rooms and lighting, hand-tracking accuracy, passthrough quality, guardian and boundary behaviour, spatial audio, ergonomics and fit, thermal and battery behaviour, eye tracking, and store review. Agents never mark these passed; they produce exact steps and the numbers they can capture.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | simulator or the main headset: install, launch, enter the immersive mode, finish the first interaction, exit cleanly |
| check | smoke cell, plus changed interactions and scenes, plus a performance capture of the heaviest scene |
| full | pairwise over device × input (hands, controllers) × play space (seated, standing, room-scale) × lighting × locomotion setting |
| release | each supported device and OS version, both inputs, every locomotion mode, a 30-minute comfort session, soak, interruptions, plus human checks |

Dimensions: device and OS version (Quest 2, 3, 3S, Pro, Vision Pro, PC VR headsets, Pico); input (controllers, hand tracking, eye and gaze, voice, game controller); play space (seated, standing, room-scale, small and large, shared rooms); lighting (bright, dim, mixed, sunlit, reflective surfaces); locomotion (teleport, smooth, snap turn, smooth turn, vignette on and off); session length; player height and handedness; language; passthrough on and off.

## Check catalogue

### Build, install and launch
- [high · auto] Build for each target and install on the device or the simulator → installs and launches without errors; the manifest declares the right features and permissions {smoke}
- [high · agent] Launch, enter the immersive experience, reach the first interaction and exit back to the home environment → no crash, black screen, stuck loading or missing controller {smoke}
- [medium · auto] Check the manifest and entitlements (hand tracking, passthrough, eye tracking, spatial anchors, camera access, microphone) against the features used → each requested permission is used; each use is explained to the user; no sensitive access without a prompt {security}
- [medium · auto] Check the build size, loading time and first-run download → within the store's limits and the stated time; a loading screen is comfortable (no frozen view, no head-locked flicker)
- [medium · agent] Install an update over the previous version → saves and settings are kept; the app opens in a comfortable state
- [medium · agent] Check the app's home-screen and library icon, name and launch screen on each device → correct, not stretched or cut off

### Frame rate, performance and comfort
- [high · auto] Capture performance in the heaviest scene for 5 minutes on the target device (OVR Metrics Tool, Instruments or the engine profiler) → holds the target refresh rate (for Meta Quest, an allowed rate such as 72, 80, 90, 96, 100 or 120 Hz, with 72 Hz the default; the frame budget at 72 Hz is about 13.9 ms and 11.1 ms at 90 Hz); dropped and stale frames are counted; any dips are brief and not systemic [4]
- [high · auto] Record stale frames, dropped frames and frame-time spikes during scene loads, menu opens, combat or crowded scenes and passthrough toggles → no repeated hitches; loads happen behind a comfortable transition, not a frozen head view
- [high · auto] Check that head-tracked content never stops updating: pause menus, loading, errors and the app going to background must keep the view responsive or hand over to the system → the view never freezes with the head locked wrong
- [medium · auto] Measure CPU and GPU levels, memory and temperature over a 30-minute session → no throttling that drops frame rate; no memory growth; the headset isn't too hot to wear
- [medium · auto] Check battery drain per hour for the main use → within the stated claim; no hot idle
- [medium · agent] Check each graphics setting and foveation or dynamic resolution → each applies; visual quality is acceptable; lower settings hold the target
- [high · human] Play 20 to 30 minutes with the default comfort settings and note any nausea, eye strain or disorientation (seated and standing) → no one in the test group needs to stop; comfort options are discoverable
- [medium · agent] Check locomotion modes: teleport, smooth movement, snap and smooth turning, vignette, speed and acceleration options, stairs and slopes, and moving platforms → each works; defaults are comfortable; options persist and appear in the first-run flow {a11y}
- [medium · agent] Check camera and world rules: no forced camera movement, no head bob by default, no camera shake without a comfort option, sensible near-clip distance, objects not placed too close to the eyes → follows comfort guidance; changes are optional

### Tracking, boundary and play space
- [high · device] Lose tracking on purpose: cover the cameras, move into a dark room, face a blank wall or mirror, remove hands from view → the app pauses or fades gracefully with a clear message; recovers on its own; no teleporting or flinging objects
- [high · device] Walk into the boundary (guardian or play area) and out of it; change the play space during a session → the system boundary shows; the app doesn't let the player cross into obstacles; content outside the play area stays reachable by other means
- [high · device] Recentre the view by the system gesture or button mid-session → the content re-aligns sensibly; menus and the world stay at a comfortable height and distance
- [medium · device] Play seated, standing and in a small space; at different heights (a child, a tall adult) and left-handed → reach, floor height and interaction ranges work for each; a height and handedness setting exists
- [medium · device] Change lighting and surfaces (sun, lamps, glass, mirrors) → tracking holds or degrades gracefully with a message
- [medium · device] Two people in the room or a pet crossing the space → the app and boundary system cope; no accidental input from the second person (shared-space risk is documented)
- [medium · device] Check anchors and persistent content (spatial anchors, saved room layouts) after restart and in a different room → anchors restore or fail gracefully with an option to re-place

### Input: controllers, hands, gaze and voice
- [high · device] Do the full flow with controllers only, and with hands only (if hand tracking is claimed) → every action and menu works with each alone; switching between them mid-session is smooth {smoke}
- [medium · device] Hand-tracking edge cases: fast movement, hands overlapping, gloves, poor light, a hand leaving the field of view, small and large hands → pinch and grab detection is reliable; no stuck grab; no unintended activation
- [medium · device] Controller edge cases: low battery, a controller turned off or disconnected mid-session, one controller only, swapped hands → a clear message; the game pauses; single-handed play works where claimed {a11y}
- [medium · agent] Check button prompts and glyphs for the active input and the platform's naming → match the physical device; hands show gestures, not buttons
- [medium · device] Gaze and eye-tracking input (Vision Pro, Quest Pro) → targets are large enough; dwell times adjustable; a fallback exists; the app doesn't store or send eye data without consent {security}
- [medium · agent] Voice input and dictation (if used) → works in noise and with accents; clear fallback; microphone permission explained
- [medium · agent] Use a game controller or keyboard and mouse where claimed (PC VR, Vision Pro with accessories) → every action works

### Display, UI and text legibility
- [high · human] Read every piece of text at normal use distance and angle, in the dimmest and brightest settings, with and without glasses → readable without leaning in; size and contrast adequate; nothing sits at the edge of the field of view
- [high · agent] Check UI placement: menus and HUD at a comfortable distance and height, head-locked UI avoided or kept minimal, world-locked or lazy-follow panels, UI doesn't clip into walls or the player's hands → comfortable; adjustable height and distance
- [medium · agent] Capture screenshots of each UI panel at 1280×800 or smaller (and a headset capture) → no overlapping, cut-off or untranslated text; contrast passes {a11y}
- [medium · agent] Check text and UI scaling, high-contrast mode and language changes (including long languages and right-to-left) → UI adapts; text still fits {a11y}
- [medium · human] Check depth, scale and world detail for jarring stereo errors, shimmer, aliasing and z-fighting → comfortable; no flicker that could trigger discomfort
- [medium · human] Check for flashing, strobing and high-contrast patterns → none above safe thresholds, or a warning and an option to reduce

### Passthrough and mixed reality
- [high · device] Enable passthrough and place virtual content on real surfaces, walls and the floor in a real room → content sits correctly and is occluded or not as designed; scene understanding works; the app asks for the permission it needs and handles a denial
- [medium · device] Change lighting and move quickly with passthrough on → stays usable; no unsafe blindness when passthrough fails; the system's safety return works
- [medium · device] Switch between VR and passthrough and back, and use the system passthrough toggle → content and state stay; no hitch
- [medium · agent] Check privacy of camera and room data (scene meshes, images, anchors) → used on-device unless disclosed; no frames saved or sent without consent {security}

### Audio
- [medium · human] Spatial audio: sources positioned correctly when turning the head and walking around, with headset speakers and headphones → direction and distance are believable; occlusion and reverb feel right
- [medium · agent] Check audio on session interruptions (system menu, a call, a notification, removing the headset) → pauses and resumes properly; no stuck loops
- [medium · agent] Check volume controls, mute, and loudness consistency → no sudden loud sounds; the volume setting persists
- [medium · agent] Check subtitles and visual cues for key audio, with position inside the field of view → readable and not head-locked in a nauseating way {a11y}

### Interruptions, suspend and lifecycle
- [high · device] Take the headset off (proximity sensor) and put it back on, open the system menu, pause by the system button and return after 5 minutes → the app pauses, keeps state and resumes in a comfortable position; no crash
- [high · device] Take a call, get a notification, lock the device, low battery warning, shutdown and restart mid-session → saves work; the app restores or restarts cleanly
- [medium · device] Switch to another app and back, the Quest universal menu, and the Vision Pro Digital Crown press and app switcher → the app handles focus loss; no audio left playing; immersive space exits or shares as designed
- [medium · agent] WebXR: end the session by the browser, tab switch, navigate away, device lost and permission denied → `end` events handled; the page returns to a usable 2D state; no stuck canvas
- [medium · device] Network loss and slow network in online experiences → clear message; multiplayer rejoin works; no frozen view

### Multiplayer, social and safety
- [high · agent] Two clients (simulators or devices) in the same space: join, leave, drop and rejoin → state syncs; avatars appear once; no ghost players
- [high · human] Personal boundary and safety tools: block, mute, report and personal space bubble in social experiences → exist, work and are easy to reach from within VR {security}
- [medium · agent] Voice chat and text chat moderation, age settings and parental controls per the platform's rules → work as described
- [medium · agent] Check user-generated content and shared spaces for moderation hooks → present where required
- [medium · agent] Age and comfort ratings shown in the store and in-app match the content → consistent (see `../gates/age-ratings.md`)

### WebXR specifics
- [high · agent] Open the page over HTTPS, feature-detect `navigator.xr`, request an `immersive-vr` or `immersive-ar` session in the emulator, and leave → works; unsupported browsers see a helpful non-XR page {smoke}
- [medium · agent] Request optional and required features (hand tracking, local-floor, anchors) and deny each → the app degrades gracefully; the permission prompt explains the use
- [medium · agent] Check the frame loop uses the XR session's frame callback, handles `visibilitychange`, and doesn't run heavy work on the main thread → no dropped frames in the emulator trace; resources are freed on exit
- [medium · agent] Check the page in desktop and mobile non-XR mode → a fallback 2D or inline view works {a11y}

## Gates

Platform stores have their own technical and content requirements (Meta Horizon Store's performance and comfort checks, Apple's visionOS App Store review, Steam and SteamVR rules, Pico store). Read the current rules on the store's site and don't quote numbers you haven't checked; `byo.md` takes a client's own checklist. Block release when:

- The target frame rate isn't held in the heaviest scenes on the target device.
- The app can freeze the view (a head-locked freeze or a long blocking load) or crash on tracking loss, boundary, recentre or removal of the headset.
- Comfort testers report discomfort at default settings and no comfort options exist.
- Any input mode claimed (hands, controllers) is incomplete.
- Camera, room or eye data is used without consent or disclosure.
- Debug menus or test content ship.

## Human-only checks

- [human] Wear the headset for a 30-minute session using the default settings, with a short break after → record any nausea, headache, eye strain or neck strain; stop immediately if you feel unwell.
- [human] Test with at least two other people of different height, glasses use and VR experience → they can start and play without help; comfort options make sense.
- [human] Walk around a small and a large real room and use the boundary system → you are never put at risk; the boundary is respected.
- [human] Read menus, subtitles and in-world text at your normal distance → comfortably legible.
- [human] Listen to the spatial audio with the headset speakers and with headphones → directions and distances feel right; levels comfortable.
- [human] Test hands, controllers, eye tracking and voice with your own devices → accurate and not tiring.
- [human] Submit to the store with your own developer account and track review → accepted. (Agents never submit.)

## Known pitfalls

- **Simulator frame rate isn't device frame rate.** Don't report performance from the Meta XR Simulator, the visionOS simulator or the WebXR emulator. Use the device.
- **A screenshot is flat.** Depth, scale, comfort and legibility can't be judged from a capture or mirrored view.
- **Average fps hides dropped frames.** Count stale and dropped frames; a brief one-off dip with quick recovery isn't a systemic failure [4].
- **Tracking glitches in poor test rooms** (dark, plain white walls, mirrors, sunlight) are environment problems; retry in a normal room before filing.
- **Dev mode and sideloaded builds** run differently from store builds in permissions and prompts. Note which you tested.
- **The first launch after install** is slower (shader compile, asset load). Measure the second run.
- **Hot headsets and low battery** throttle. Let the device cool and charge before a performance capture.
- **Comfort is personal.** A single tester's discomfort is a data point; record the setup and ask others before deciding severity.
- **Don't test with real children or in public spaces.** Use adult testers in a safe, clear room.
- **Store feature names and device specs change quickly;** check the current docs before stating a requirement.

## Sources

1. [Meta Horizon: Meta XR Simulator](https://developers.meta.com/horizon/documentation/unity/xrsim-intro/) — run OpenXR apps without a headset (checked 2026-11-16)
2. [Apple: running your app in Simulator or on a device](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device) — visionOS Simulator in Xcode (checked 2026-11-16)
3. [Immersive Web Emulator (Meta Quest)](https://github.com/meta-quest/immersive-web-emulator) — WebXR emulator browser extension (checked 2026-11-16)
4. [Meta Horizon: performance and VRC best practices](https://developers.meta.com/horizon/documentation/unity/ts-ovr-best-practices/) — allowed refresh rates, 72 Hz default, frame budgets 13.9 ms at 72 Hz and 11.1 ms at 90 Hz, brief dips acceptable if not systemic; Meta's [VRC.Quest.Performance.1](https://developers.meta.com/horizon/resources/vrc-quest-performance-1/) currently sets a 60 fps rendering floor at an allowed refresh rate, while older guidance pages still say 72 fps, so confirm on the VRC page (checked 2026-11-16)
5. [Meta Horizon: testing localization](https://developers.meta.com/horizon/resources/testing-localization/) — localisation checks for truncation, overlap and glyphs (checked 2026-11-16)
6. [W3C: WebXR Device API](https://www.w3.org/TR/webxr/) — sessions, features and secure-context requirement (checked 2026-11-16)
