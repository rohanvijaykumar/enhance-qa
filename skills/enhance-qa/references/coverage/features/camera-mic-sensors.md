---
module: camera-mic-sensors
kind: feature
title: Camera, microphone and sensors
checked: 2026-11-16
---
# Camera, microphone and sensors

Covers anything that reads a camera, microphone, motion or orientation sensor, barcode/QR scanning, or similar hardware input, on web, mobile and desktop. It does not cover location (see `maps-location.md`), media playback of the recorded result (see `media-playback.md`) or uploads of the recording (see `file-upload-download.md`). It usually goes with a platform module, `privacy-consent.md` and `onboarding.md` (permission priming).

## Signals

- Code calls `getUserMedia`, `MediaRecorder`, `DeviceOrientationEvent`, `DeviceMotionEvent`, `Sensor` APIs, `navigator.mediaDevices`, WebRTC.
- iOS: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSMotionUsageDescription` in Info.plist; `AVCaptureSession`, `CoreMotion`.
- Android: `CAMERA`, `RECORD_AUDIO`, `BODY_SENSORS` permissions in the manifest; CameraX, `MediaRecorder`, `SensorManager`.
- Desktop: macOS entitlements for camera/audio-input; Windows capability `webcam`/`microphone`; Electron `systemPreferences.getMediaAccessStatus`.
- Dependencies such as `react-webcam`, `expo-camera`, `react-native-vision-camera`, `zxing`, `mlkit` barcode scanning, `tesseract`.
- README mentions scan, record, voice, photo, video call, QR, gestures, shake, step counting, AR.

## Kickoff questions

1. Which devices and inputs does the product use: camera, microphone, motion/orientation, other? (best guess: read it from the permissions declared in the code)
2. Is a real camera/microphone available on the test machine, or only a simulator's fake feed? (best guess: fake feed only; real-device checks become human or device checks)
3. Are recordings or frames sent anywhere (server, AI service, call peers)? (best guess: yes if there is any upload code; then privacy checks apply)

## Drivers

1. **Browser automation with a fake media device.** Best for web. Playwright (Chromium) with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, optionally `--use-file-for-fake-video-capture=<file.y4m|.mjpeg>` and `--use-file-for-fake-audio-capture=<file.wav>`. Use `context.grantPermissions(['camera','microphone'])` and `permissions: []` for the deny case. Observe through the scoped accessibility tree and `page.evaluate` on `navigator.mediaDevices.enumerateDevices()`. Limit: fake feeds prove the code path, not image quality, focus, or real hardware quirks. Firefox and WebKit have different flags and weaker support.
2. **Simulator and emulator controls.** iOS Simulator: `xcrun simctl privacy <device> grant|revoke|reset camera|microphone <bundle-id>` resets and sets permission state. The Simulator has no real camera for capture; photo-library injection works through `xcrun simctl addmedia`. Android Emulator: virtual scene camera or webcam passthrough in AVD settings; `adb shell pm grant|revoke <package> android.permission.CAMERA`; `adb shell pm reset-permissions`; virtual sensors (accelerometer, rotation) in the emulator's Extended controls; `adb emu rotate`. Limit: emulated sensors are idealised and noise-free.
3. **Desktop OS permission state.** macOS: `tccutil reset Camera <bundle-id>` and `tccutil reset Microphone <bundle-id>` reset a prompt; System Settings > Privacy & Security shows the grant. Windows: Settings > Privacy > Camera/Microphone toggles; drive with UI Automation only for the app's own windows. Limit: OS settings panes are not reliably scriptable; mark as human where needed.
4. **Unit and contract tests.** Mock the media layer to feed errors (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`) and assert the app's handling. Cheap and deterministic. Use for every error branch.
5. **Computer use or a person with a real device.** Last resort for anything needing real hardware (see below).

Cheap observation: after setting permission state and loading the page, read the accessibility tree once and the console once. Take screenshots only for preview framing, orientation and overlay checks, at 1280×800 or smaller.

**Can't be driven here:** real camera quality, autofocus, low-light behaviour, flash/torch, physical rotation and shake, real ambient sound and Bluetooth headsets, hot-plugging a USB camera, hardware privacy shutters and LEDs, OS-level privacy indicators (the orange/green dot, status-bar icons). These become device or human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | Grant permission on first request, capture once with a fake device, result is saved or shown |
| check | Smoke, plus deny and revoke-later, plus no-device |
| full | Pairwise over: permission state (not asked, granted, denied once, denied permanently, revoked while open) × device count (none, one, two or more) × orientation × app state (foreground, background, interrupted by call) |
| release | Every cell on at least one real phone and one laptop with a real camera and microphone, plus privacy-indicator and battery checks |

Dimensions: permission state, device count, device type (built-in, USB, Bluetooth), orientation, light level, platform (Chromium, Firefox, Safari/WebKit, iOS, Android, desktop OS), foreground/background, recording length.

## Check catalogue

### Permissions
- [high · agent] First use: trigger the feature with permission not yet asked → a clear in-app reason is shown (or the OS prompt appears with the declared usage text), and nothing is captured before the user agrees {smoke}
- [high · agent] Grant the permission → the preview or capture starts without a reload and without a second prompt
- [high · agent] Deny once → the app shows a plain explanation and a way to retry or continue without the feature; no blank preview, spinner that never ends or crash
- [high · agent] Deny permanently ("Don't ask again", or browser "Block") → the app explains how to re-enable in settings and links or names the right place; the retry button doesn't loop on a dead prompt
- [high · agent] Revoke the permission while the app is open and capturing → capture stops cleanly, the UI reflects it within a few seconds, no crash, no frozen last frame shown as live
- [medium · agent] Revoke the permission while the app is closed, then relaunch → the app detects the new state and doesn't assume the old grant
- [medium · agent] Re-grant from settings after a denial, return to the app → the feature works without reinstalling or clearing data
- [medium · auto] Permission usage strings or manifest entries exist for every sensor used, and none are declared that the code never uses → each used permission has a specific human-readable reason; no unused sensitive permission
- [medium · agent] Permission requested only when the feature is used, not on app launch, unless the product is plainly a camera or voice app → no prompt before the user reaches the feature
- [medium · agent] Web: page served over HTTP (not localhost) or in an insecure iframe → feature is disabled with a message, or the error is handled; no raw exception shown
- [medium · agent] Web: embedded in an iframe without `allow="camera; microphone"` → the app shows a handled error, not a blank frame

### Devices
- [high · agent] No camera or microphone present (fake devices off, or a desktop without webcam) → the app says "no camera found" in plain words and offers an alternative such as upload; no crash {smoke}
- [high · agent] Camera present but in use by another app (`NotReadableError` or equivalent) → handled message that names the likely cause; the app recovers when the other app releases it
- [medium · agent] Two or more cameras or microphones → the app uses a sensible default and lets the user switch; the switch takes effect live; the choice persists if the product claims it does
- [medium · device] Unplug the camera, USB microphone or Bluetooth headset while in use → capture ends or falls back with a message; plugging back in works without restarting
- [medium · device] Front and back cameras on a phone → the switch works, mirroring is right for the front camera (selfie mirrored on preview, not in the saved result unless the product says so)
- [low · agent] Device list names → shown as readable labels after permission is granted (browsers hide labels until then; that isn't a bug)

### Capture quality and constraints
- [high · agent] Take a photo or record a clip, then open the saved file → the file exists, opens in another player, has the expected type, duration and resolution, and isn't zero bytes or black {smoke}
- [medium · agent] Recording audio with the fake audio file → the saved audio plays back and its duration matches the source within a small tolerance
- [medium · device] Photo in portrait and landscape, and device rotated mid-preview → the preview, overlays and saved image are the right way up; no stretched or letterboxed preview; EXIF orientation respected when shown elsewhere
- [medium · device] Low light, backlit scene, very bright scene → the app stays usable: the shutter still works, a helpful hint appears if it needs light (for scanning), no crash
- [medium · device] Torch/flash toggle where offered → it lights, and turns off when the app stops capturing or is backgrounded
- [low · device] Zoom, tap-to-focus and exposure controls where offered → respond smoothly, stay within the device's range
- [medium · agent] Request a resolution or frame rate the device can't give (`OverconstrainedError`) → the app falls back or says so; no black preview

### Limits and long sessions
- [high · agent] Recording limits: record to the product's stated maximum length or file size → it stops at the limit with a clear message, and what was recorded so far is kept and playable
- [medium · agent] Stop immediately after start, and start/stop 20 times quickly → each result is valid or discarded cleanly; no leaked streams (browser tab indicator turns off; `getTracks()` all `readyState: ended`)
- [high · agent] Leave and return to the screen, close the dialog, navigate away → all tracks stop; the camera light and tab recording indicator turn off
- [medium · device] Record for 10+ minutes on a real phone → no overheating warning loop, no memory growth to a crash, the file isn't corrupt
- [medium · agent] Disk or storage nearly full while recording → handled error and a partial file kept or cleanly removed; no crash
- [medium · agent] Extremely loud, silent and very short audio → saved; waveform or level meter behaves; no divide-by-zero or NaN display

### App state and interruptions
- [high · device] Send the app to the background while capturing (home button, app switch) → capture pauses or stops as designed, the OS indicator disappears, the app resumes or restarts cleanly; it must not keep the microphone on silently unless it declares a background-audio mode {security}
- [medium · device] Incoming phone call, alarm, or another app taking the microphone during recording → the app pauses or ends with a message; the partial recording survives
- [medium · agent] Switch browser tabs or minimise the window during web capture → behaviour matches the claim; the camera indicator reflects reality
- [medium · agent] Lock screen and unlock during preview → the preview recovers or restarts without a reload
- [low · device] Low-battery mode or thermal throttling → the feature degrades gracefully

### Sensors (motion, orientation, scanning)
- [medium · agent] Web: `DeviceOrientationEvent.requestPermission` on iOS Safari → called from a user gesture; deny is handled; the feature offers a non-motion fallback
- [medium · agent] Emulator virtual sensors: feed a rotation, an acceleration spike and a still device → the app's reaction matches its docs; no jitter-driven flicker at rest
- [medium · device] Real shake, tilt and walking (step counter) on a phone → readings are plausible and the app doesn't trigger on small vibrations
- [medium · agent] Barcode/QR scanning with test codes (valid, unreadable, wrong format, very long, a URL, a text with markup) → valid codes parse; invalid ones give a clear message; a scanned URL is shown before opening and never auto-opened {security}
- [low · agent] Sensor missing on the device (no gyroscope) → the feature hides or explains; no error loops

### Privacy and safety
- [high · device] A visible indicator is shown whenever capture is live, and disappears when it stops → OS privacy dot or status icon, plus the app's own recording indicator {security}
- [high · agent] Network log during capture → frames or audio go only where the product's privacy text says; nothing is uploaded before the user presses record or send {security}
- [medium · agent] Saved files: where they go and who can read them → stored in app-private storage or where the user chose; not in a world-readable temp folder; thumbnails and caches are removed when the user deletes the item
- [medium · agent] Delete a recording → it is gone from the list, storage and any server copy; the file isn't recoverable through the app
- [medium · agent] EXIF and metadata in photos → location and device data are stripped or disclosed if the product shares photos publicly
- [medium · agent] Camera or microphone in a screen the user didn't open (a hidden or background tab) → none; capture starts only after a user action

### Simulators and fake devices
- [medium · agent] Run the whole flow with the fake camera/mic → passes; record in the notes that real-hardware cells are still open
- [medium · agent] Fake feed that is a still colour or silence → the app doesn't treat "no motion" or "no sound" as failure unless the product says so

## Gates

- Apple App Store and Google Play review check that each sensor permission has a purpose string or declaration and is used; see `../gates/apple-app-store.md` and `../gates/google-play.md`.
- Privacy: see `privacy-consent.md` and `../gates/privacy-law.md` (recordings of people are personal data; children's cameras raise COPPA issues).

## Human-only checks

- [human] On a real phone, take a photo in a dim room and in sunlight, in both orientations → image is sharp enough, correctly rotated, correctly exposed for the product's purpose.
- [human] On a real laptop with a webcam, join or start a call or recording, then check the hardware light and the OS privacy indicator → the light and indicator are on only while capture is live, and go off within a few seconds after stop.
- [human] Plug in a Bluetooth headset mid-recording, then remove it → audio stays sensible, and the app tells the user what changed.
- [human] Record 10 minutes while using the phone normally (calls, notifications) → no surprising battery drain or heat, and the recording is complete.
- [human] Say a sentence in a noisy room (voice features) → recognition quality is acceptable for the product's claim.

## Known pitfalls

- **Chromium's fake device shows a green test pattern and a beep.** That is the expected stream, not a rendering bug.
- **Browsers hide device labels** until permission is granted; empty labels before that aren't a defect.
- **Permission prompts may not appear in headless runs.** Use `grantPermissions` or the fake-UI flag; don't report "no prompt".
- **Safari/WebKit under Playwright isn't real Safari.** iOS Safari behaviour on motion permission and camera needs a device.
- **Simulators don't have a camera.** iOS Simulator can't capture; test with the library or a fake and mark real capture as a device check.
- **Mirrored selfie preview is normal.** Only the saved output matters.
- **A browser's "camera in use" tab dot after leaving the page** is a real finding (a leaked track), but a dot while the page is open isn't.
- **macOS and Windows may cache a denied prompt.** Reset with `tccutil` or OS settings before retesting.
- **Don't test with real people's faces or voices.** Use test files or your own team's consent.

## Sources

1. [MDN: MediaDevices.getUserMedia() errors](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — error names and secure-context rule (checked 2026-11-16)
2. [Playwright: Emulation and permissions](https://playwright.dev/docs/emulation) — permissions, grant, and emulation limits (checked 2026-11-16)
3. [Android: Permissions overview](https://developer.android.com/guide/topics/permissions/overview) — runtime permission model (checked 2026-11-16)
4. [Android Emulator: virtual sensors](https://developer.android.com/studio/run/emulator) — emulator controls (checked 2026-11-16)
5. [Apple: Requesting authorization to capture media](https://developer.apple.com/documentation/avfoundation/capture_setup/requesting_authorization_to_capture_and_save_media) — camera/microphone authorisation and usage strings (checked 2026-11-16)
6. [W3C Permissions Policy](https://www.w3.org/TR/permissions-policy/) — iframe `allow` for camera and microphone (checked 2026-11-16)
