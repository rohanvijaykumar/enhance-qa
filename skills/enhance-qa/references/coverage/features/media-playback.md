---
module: media-playback
kind: feature
title: Media playback and captions
checked: 2026-11-16
---
# Media playback and captions

Audio and video playing in the product: web players, native players, streaming (HLS, DASH), podcasts, music, course videos, captions and subtitles, audio descriptions. Authoring deliverables (DVD menus, loudness, subtitle files for broadcast) are in `../platforms/tv-media-deliverables.md`; capture of camera and microphone is in `camera-mic-sensors.md`. Usually goes with `web-app.md` or a mobile module, `accessibility.md` and `performance.md`.

## Signals

- `<video>`, `<audio>`, `<track>`, `MediaSource`, `hls.js`, `dash.js`, `video.js`, `Shaka Player`, `Plyr`, `react-player`, Mux, Cloudflare Stream, YouTube or Vimeo embeds.
- Native: `AVPlayer`, `AVKit`, `ExoPlayer`, `Media3`, `MediaPlayer`, `libVLC`, `MediaSession`.
- Files `.m3u8`, `.mpd`, `.mp4`, `.webm`, `.vtt`, `.srt`, `.mp3`, `.m4a`; DRM terms (Widevine, FairPlay, PlayReady, EME).

## Kickoff questions

1. Which media formats and sources are played (uploaded files, streams, embeds), and on which clients? (best guess: MP4/H.264 and HLS on web plus one mobile app)
2. Are captions, audio descriptions, multiple audio tracks or DRM promised? (best guess: WebVTT captions, no DRM)
3. Is there test content: a short clip, a long one, a live stream, and DRM test streams? (best guess: use short open test clips and generate others with `ffmpeg`)

## Drivers

1. **Generated and open test media.** Best default. Make clips with `ffmpeg` (test patterns and tones with `testsrc`, `sine`) in each codec, container, frame rate, resolution and with edge cases: no audio track, audio only, odd dimensions, variable frame rate, long duration, broken index. Known-good open samples (Big Buck Bunny, Tears of Steel, Apple HLS examples) cover normal playback.
2. **Probe tools.** `ffprobe`, `mediainfo`, `MP4Box`, `mediastreamvalidator` (Apple HLS), `ffmpeg -v error -i file -f null -` to find stream errors; WebVTT validators; `subtitle-edit` or `ffmpeg` for caption conversion.
3. **Playwright (Chromium, Firefox, WebKit) with scripted `HTMLMediaElement` reads.** Read `currentTime`, `paused`, `readyState`, `buffered`, `error`, `videoWidth` and events via `page.evaluate`; use autoplay flags only to test policies on purpose. Playwright's bundled Chromium has no proprietary codecs (H.264, AAC); use branded Chrome or Edge (`channel: 'chrome'`) or WebKit for those.
4. **Network shaping.** DevTools throttling, Playwright route delays, `tc netem` or Network Link Conditioner to test buffering, adaptive bitrate switching and stalls.
5. **Emulators and simulators** (Android emulator, iOS simulator) for playback, rotation, background audio and media-session behavior. DRM-protected playback needs real hardware.
6. **Player and server logs.** hls.js and Shaka debug events, CDN logs for range requests and manifest fetches.

**Can't be driven here:** audio quality by ear (distortion, sync, loudness), picture quality, subjective buffering feel, real HDR displays, hardware decoding differences, Bluetooth and car audio routing, Chromecast and AirPlay, lock-screen controls and background audio on real phones, and production DRM licences (Widevine L1, FairPlay on real devices). These are human or device checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | play a standard clip to the end, with sound, on the main browser |
| check | smoke, plus seek, pause, resume and the changed format |
| full | format x client x network x caption state |
| release | all of full, DRM test streams, long-form soak, device and human checks |

Dimensions: container and codec (MP4/H.264/AAC, WebM/VP9/Opus, AV1, HLS, DASH), client (Chrome, Firefox, Safari, iOS Safari, Android Chrome, native apps), network (fast, 3G-like, drops), caption state (off, on, language), audio track, orientation, power state.

## Check catalogue

### Playback basics
- [high · agent] Open a media item and press play → starts within the target time (about 3 seconds on a good network), video and audio in sync, plays to the end, ends with a clear end state (replay, next item) {smoke}
- [high · auto] Probe each shipped test file → every promised container and codec plays in each supported browser or app (compare with a support table); unsupported ones give a clear message, not a black frame
- [medium · agent] Pause, resume, replay, volume, mute, speed (0.5x to 2x, pitch kept), fullscreen and exit → every control works with mouse, keyboard and touch; state persists across fullscreen
- [medium · agent] Audio-only, video-only, and no-audio-track files → player UI fits (no empty video box for audio); no error for a missing track
- [medium · agent] Odd cases: portrait video, ultra-wide, odd dimensions, 60 fps, variable frame rate, very short (1 s) and very long (4 h) → plays correctly; aspect ratio is kept (no stretch); timeline and duration right
- [medium · agent] Broken media (404, truncated file, wrong MIME type, expired signed URL, forbidden) → human error message with retry, not an endless spinner or a silent black frame
- [medium · agent] Poster image and thumbnails → load, right aspect, shown before play; sprites on scrub match the time

### Seeking and resume
- [high · agent] Click the middle of the timeline, drag the handle, press arrow keys and `j`/`l` type shortcuts if offered → playback jumps to the right time (compare with `currentTime`), resumes, no stuck state; works on a not-yet-buffered range {smoke}
- [medium · agent] Seek to 0, to the last second, past the end, and rapidly many times → no crash, no loop; end event fires once
- [medium · auto] Server supports HTTP range requests (`Accept-Ranges`, 206) and keyframe-aligned seeks for progressive MP4; MP4 `moov` atom at the start (fast start) → seeking and start are fast
- [medium · agent] Resume where you left off (if offered), per user and per device → right position, cleared at the end, not shared with another user {security}
- [medium · agent] Chapters and bookmarks (if offered) → jump to the right time; names and times match

### Buffering and slow networks
- [high · agent] Throttle to slow 3G and then to offline mid-play → buffering indicator shows; after restore, playback resumes at the same position; no permanent stall {smoke}
- [medium · agent] Adaptive streaming: throttle down and up → quality drops and rises smoothly without restarting; manual quality choice sticks; "auto" works; no endless switching
- [medium · auto] HLS/DASH manifests and segments → valid (Apple `mediastreamvalidator` or `ffprobe`); all renditions reachable; segment durations steady; audio and video aligned
- [medium · agent] Start on a slow network → starts at a low rendition for fast start, not a long blank wait
- [medium · agent] Many players on one page, hidden tabs, or off-screen videos → off-screen media pauses or doesn't preload heavily; data use is reasonable
- [medium · agent] Live streams: join late, pause and resume, live edge, stream ending or restarting → correct state messages; DVR window works; no crash
- [medium · agent] Metered or data saver mode (mobile) → respects settings, or warns before large downloads

### Autoplay, background and system integration
- [high · agent] Autoplay behavior → with sound, browsers usually block it until the user acts; muted autoplay works where allowed; the player shows a play button when blocked, not a broken state {smoke}
- [medium · agent] Autoplay of next item, or loop → matches the setting; user can turn it off; no audio blast at page load
- [medium · agent] Two media items at once → starting one pauses the other (or per design); no overlapping audio
- [medium · device] Background audio: lock the phone, switch apps, leave the browser tab → audio keeps playing if promised (podcasts, music) and stops if not; interruptions (call, alarm) pause and resume correctly
- [medium · device] Lock-screen, notification and headset controls, and the Media Session API (`navigator.mediaSession`) → title, artwork, play, pause, seek work; metadata is right
- [medium · agent] Picture-in-picture (browser button and `requestPictureInPicture`, or native PiP) → starts, controls work, returning to the page restores the player; captions continue
- [medium · device] Headphones plug and unplug, Bluetooth, casting (AirPlay, Chromecast) → pauses on unplug; routes correctly; resumes at the right position
- [medium · agent] Orientation change and window resize, fullscreen in landscape → layout holds; playback continues; no black bars where avoidable
- [low · agent] Tab hidden, minimized or screen asleep → playback and timers behave as designed; the position is right on return
- [low · agent] Volume memory, mute persistence and per-site settings → persist across pages and sessions as intended

### Captions and subtitles
- [high · agent] Turn on captions → they appear on screen, in sync with speech (within about 0.2 s), at the right start and end times; turn them off and they vanish {smoke} {a11y}
- [high · auto] Validate each caption file (WebVTT/SRT/TTML/IMSC) → parses with no errors; cue times increase; no overlapping cues unless intended; `<track>` has `kind`, `srclang` and `label` {a11y}
- [medium · agent] Cue timing after seeking, pause, speed change and 2x playback → captions follow the audio; no stale cue on screen
- [medium · agent] Caption text: line length and lines per cue (about two lines; keep to the line-length limit in the target broadcaster's or platform's style guide, such as the BBC guidelines [9]), speaker labels, sound descriptions in brackets, music symbols → readable; no mid-word breaks; no clipped text {a11y}
- [medium · agent] Styling: size, font, colour, background, edge style, position; user settings (OS and browser caption preferences) → applied; contrast stays readable on bright and dark scenes; captions avoid hiding burned-in text and controls {a11y}
- [medium · agent] Languages: multiple tracks, default selection by user language, switching mid-play, a missing language → right track chosen; names shown in their own language; fallback is sensible
- [medium · agent] Non-Latin and right-to-left captions (Arabic, Hebrew, CJK), emoji, bidirectional text and punctuation → shown in correct direction and with right fonts; no tofu boxes (see `i18n-rtl.md`)
- [medium · agent] Caption encoding (UTF-8 with or without BOM), special characters, HTML tags and entities in cues → shown as text; `<script>` is not executed {security}
- [medium · agent] Captions in fullscreen, PiP and on mobile → still present and styled; controls to toggle are reachable
- [medium · agent] Auto-generated captions (if used) → marked as automatic; accuracy spot-checked on names and numbers
- [medium · human] Caption quality for a sample of real content → accurate, complete and in sync; includes non-speech sounds that matter {a11y}
- [low · agent] Transcript (if offered) → matches captions, searchable, click-to-seek works

### Audio descriptions and accessibility
- [medium · agent] Audio description track (extra audio track or alternate video) → selectable by keyboard; plays in sync; remembered between sessions; described in the UI {a11y}
- [medium · agent] Player controls → operable by keyboard and screen reader, with labels, visible focus and time and state announced; Space toggles play; no keyboard trap {a11y}
- [medium · agent] No content flashes more than three times per second, and media doesn't autoplay with sound over screen reader speech; pause control for moving content is available {a11y}
- [medium · agent] Reduced motion setting → autoplay of decorative looping video is off or paused {a11y}
- [low · agent] Volume and caption controls on touch targets of adequate size {a11y}

### DRM and protected content (test content only)
- [high · device] Play the DRM vendor's test streams (Widevine, FairPlay, PlayReady test content and licence servers) → plays on supported browsers and devices with each security level; clear error on unsupported ones
- [medium · agent] Licence expiry, offline download rules, concurrent stream limits (if promised) → enforced; messages are clear; the licence server is called, not bypassed {security}
- [medium · agent] Screenshots and screen recording of protected content → blocked or black where the platform supports it; no claims beyond that
- [medium · agent] Signed and expiring media URLs, token and hotlink protection → expired or foreign-origin requests are refused {security}
- [medium · agent] Token renewal during a long playback (signed URL or licence expiry mid-stream) → seamless renewal; no sudden stop

### Performance and resources
- [medium · agent] Memory, CPU and battery during 30 to 60 minutes of playback → stay flat; no leak after stopping and starting many times; media elements are released on page change
- [medium · auto] Time to first frame, rebuffer ratio, dropped frames → within target in a throttled run; hls.js/Shaka stats read through the player's API
- [low · agent] Preload settings, thumbnails and large posters → don't download the whole video on page load

## Gates

- Core formats play in each supported browser or app, with sound, seeking and end handling.
- Captions load, sync and are usable; files validate.
- Buffering recovers after a network drop.
- Autoplay policy respected; player controls are keyboard-accessible.
- DRM test content plays on target devices (device check).

## Human-only checks

- [human] Watch a full clip on a laptop and a phone, with headphones → audio and picture in sync, no pops or clipping, quality is what you'd accept
- [human] Read the captions for two minutes of real content → accurate, well-timed, comfortable to read, not covering key visuals
- [human] Lock the phone mid-podcast, take a call, plug in headphones, use Bluetooth and a car → behaves as users expect
- [human] Cast to a TV (AirPlay or Chromecast) and test picture-in-picture on real devices → works and recovers
- [human] Review audio description with a blind or low-vision user if available → useful and in time with the picture

## Known pitfalls

- **Browser autoplay blocking** is a policy, not a bug; the bug is a broken UI when it happens.
- **Bundled Chromium lacks H.264 and AAC.** A failure to play MP4 in Playwright's default Chromium is a test-environment limit; use branded Chrome/Edge or WebKit.
- **Codec support varies by OS and hardware** (AV1, HEVC, Dolby formats); compare to the product's support claim.
- **Headless browsers** have no real audio output; check `muted`, `currentTime` and events, not sound.
- **`currentTime` can be slightly off** after seeks (keyframes); only report differences of more than a couple of seconds on a seek, or per the spec.
- **Embeds** (YouTube, Vimeo) follow their own policies and ads; judge the app's wrapping, not the embedded player.
- **CDN and signed-URL expiry** in long tests look like random failures; check URL lifetime.
- **Live streams** have latency by design (a few to 30 seconds).
- Use only test or licensed content you own; don't circumvent DRM, and don't load-test CDNs or third-party players.

## Sources

1. [MDN: Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) — autoplay policies (checked 2026-11-16)
2. [MDN: HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) — states, events, errors (checked 2026-11-16)
3. [W3C WebVTT](https://www.w3.org/TR/webvtt1/) — caption file format (checked 2026-11-16)
4. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — 1.2 time-based media (captions, audio description), 1.4.2 audio control, 2.3.1 flashing (checked 2026-11-16)
5. [Apple: HLS authoring and `mediastreamvalidator`](https://developer.apple.com/documentation/http-live-streaming) — HLS validation (checked 2026-11-16)
6. [MDN: Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API) and [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) (checked 2026-11-16)
7. [Playwright: browsers and codecs](https://playwright.dev/docs/browsers) — branded Chrome and Edge channels for proprietary codecs (checked 2026-11-16)
8. [Android Media3 ExoPlayer: DRM](https://developer.android.com/media/media3/exoplayer/drm) — Widevine test content and licence setup (checked 2026-11-16)
9. [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles) — line length and timing conventions (checked 2026-11-16)
