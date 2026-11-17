---
module: tv-media-deliverables
kind: platform
title: Smart TV and set-top apps; video, audio and disc deliverables
checked: 2026-11-16
---
# Smart TV apps and media deliverables

Two related areas. (1) **TV apps:** apps for smart TVs and set-top boxes (Samsung Tizen, LG webOS, Android TV and Google TV, Amazon Fire TV, Roku, Apple tvOS, Vizio) driven by a remote and a D-pad. (2) **Media deliverables:** finished video, audio and disc products: files for broadcasters and streamers, and DVD and Blu-ray discs with menus, chapters, subtitles, audio streams and region codes. The second area is checked against a **delivery spec the client supplies** ("bring your own"); this module gives the checks and the tools, and the client's spec gives the numbers. It goes with `../features/media-playback.md` (players, captions), `web-app.md` for web-based TV apps, `android.md` for Android TV, `ios.md` for tvOS, `../features/accessibility.md`, and `byo.md` for the client's delivery spec or disc checklist.

The disc and delivery process mirrors DVD-vendor QA practice: build intake (a build acceptance test, then a build verification test), a full pass, regional checks, bug verification plus regression, a final full pass on the release candidate, then delivery checks and a go or no-go recommendation by the owner [1][2].

## Signals

- TV apps: `config.xml` with Tizen profile `tv`; `appinfo.json` (webOS); `AndroidManifest.xml` with `android.software.leanback` or `LEANBACK_LAUNCHER`; `manifest` and `.brs` or SceneGraph XML (Roku); a tvOS target; D-pad and `keydown` handlers for arrow keys, `Enter` and `Back` (`XF86Back`, key code 10009 on Tizen, 461 on webOS).
- Disc projects: `VIDEO_TS/` (`.IFO`, `.VOB`, `.BUP`), `BDMV/` (`index.bdmv`, `.mpls`, `.m2ts`), authoring project files (Scenarist, DVD Architect, Encore, DVD Studio Pro, dvdauthor XML), disc images (`.iso`, `.bin/.cue`, DDP folders).
- Delivery folders: `.mov`, `.mxf`, `.mp4`, `.wav`, `.srt`, `.scc`, `.ttml`, `.xml` with a naming convention; a client delivery spec PDF; a checksum manifest (`.md5`, `.sha256`).
- README words: "10-foot UI", "remote control", "DVD", "Blu-ray", "master", "deliverables", "loudness", "closed captions", "region code", "QC report".

## Kickoff questions

1. Is this a TV app, a media deliverable, a disc, or a mix; and which platforms or delivery targets? (best guess: from the files found; for deliverables the client's spec is required, ask for it)
2. Do you have the client's delivery or disc spec (video format, loudness, captions, naming, menu map, chapter list, region, audio and subtitle streams)? (best guess: no spec yet, so checks are marked "needs spec", with the usual defaults listed for the user to confirm)
3. What hardware and players do you have: real TVs or boxes, stand-alone DVD or Blu-ray players, a disc burner and blank discs? (best guess: only a PC; emulators and software players now, the real-player checks go to the user)

## Drivers

Best first. Deterministic tools for files and discs; emulators for apps; humans for judgement and real players.

1. **MediaInfo and ffprobe.** The first stop for any file. `mediainfo --Output=JSON file` and `ffprobe -v error -show_format -show_streams -show_chapters -of json file` report container, codec and profile, resolution, pixel and display aspect ratio, frame rate, scan type, colour primaries, transfer and matrix, range, bit depth, audio layout and sample rate, duration, chapters, timecode and tags. Compare each value with the spec by script. Cheap, exact, no agent judgement [3][4].
2. **Loudness and signal analysis.** `ffmpeg -nostats -i in -filter_complex ebur128=peak=true -f null -` prints integrated loudness (LUFS), loudness range and true peak; `ffmpeg` filters `silencedetect`, `blackdetect`, `freezedetect`, `cropdetect`, `idet` (interlace), `signalstats` (levels) and `astats` help find dropouts, black frames and level problems. GUI meters (Youlean Loudness Meter, NUGEN VisLM, Dolby Media Meter) give the same numbers a client will see. Run on the final file, not the mix [5].
3. **Checksums.** `sha256sum`, `md5sum`, `certutil -hashfile <file> SHA256`, PowerShell `Get-FileHash`. Compute on the master, and after every copy, upload or burn; compare with the manifest. Hash the contents of each disc image and of files on the disc.
4. **Caption and subtitle tools.** Subtitle Edit (checks timing overlaps, reading speed, line length, frame-rate conversion, many formats), `ccextractor` (reads CEA-608 and 708 from video), `ttconv` and EBU-TT-D and W3C TTML validators, `ffmpeg -i in.srt out.vtt` for conversion, `ffprobe` to list subtitle streams. Burn captions into a test render to check timing against picture [6][7].
5. **Broadcast QC software** (where the user has it): Telestream Baton or Vidchecker, Interra, Venera Pulsar, Vidi; free `qctools` (BAVC) graphs signal statistics across a file. These automate the technical checks against a spec template; an agent can run them and read the report, but needs the licence.
6. **Disc structure inspection.**
   - **DVD-Video:** read `VIDEO_TS` with PgcEdit, IfoEdit or a similar IFO viewer to see titles, PGCs, cells, chapters (PTTs), audio and subpicture streams, and navigation commands; `lsdvd` and `dvdbackup` read a disc's structure; VLC and libdvdnav-based players play it. PgcEdit can also step through navigation with a virtual machine and shows GPRM and SPRM values.
   - **Blu-ray:** BDInfo scans a `BDMV` folder or ISO for playlists, streams, chapters and bitrates; `tsMuxeR` and `ffprobe` read `.m2ts`; BDedit and the authoring tool's project show movie objects and playlists; software players (PowerDVD, VLC with libbluray, Leawo) play menus where supported.
   - Mount ISO images (Windows 11 mounts them natively; macOS `hdiutil attach`) and compare file listings, volume label, sizes and checksums with the spec [8][9].
7. **Authoring and verification tools** (to know about; licences and platforms vary): Sonic Scenarist (DVD and BD), Adobe Encore and Apple DVD Studio Pro (discontinued but still used), Roxio and Corel authoring, DVD Architect, DoStudio, Blu-print; replication houses run their own verifiers on the master (a DLT, DDP or disc image). Treat authoring tool project files as evidence; the final disc, not the project, is what's tested.
8. **TV app emulators and simulators.** Tizen Studio TV emulator, webOS TV simulator, Android Studio's Android TV emulator, Roku's device (a real Roku in developer mode; no official emulator), tvOS Simulator in Xcode (macOS only), Fire TV through `adb` on a Fire device or Android TV image. Drive with `adb shell input keyevent KEYCODE_DPAD_RIGHT` and `KEYCODE_DPAD_CENTER`, `KEYCODE_BACK`; Roku's External Control Protocol (ECP, HTTP `keypress/Right`, `keypress/Select`) on a dev-mode device; Appium drivers for Android TV and Roku; Xcode UI tests with the Siri Remote focus engine [10][11].
9. **Web-based TV apps in Playwright.** Set the viewport to 1920×1080, send `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter` and `Escape` or `Backspace` as the remote, read the focused element with `document.activeElement` and a scoped accessibility snapshot. Good for navigation logic; it can't prove performance on a TV's weak CPU.
10. **Computer use and screenshots** at 1280×800 or less for layout; use a capture card or the emulator's screenshot for the 1080p view.

**Can't be driven here:** the real TV, box or stand-alone DVD or Blu-ray player (remote key behaviour, region and format handling, layer-break pauses, old-player compatibility, HDMI and CEC, real DRM hardware levels); picture and sound quality judged by eye and ear on a calibrated display and monitoring; commercial DRM with real licences (use vendor test content only); real replicated discs; the client's proprietary QC systems and reviewers; app-store and platform certification (gate). These are device, human or gate checks. Agents never mark them passed.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | TV app on one emulator or device: launch, navigate with the D-pad, play one title, back out; or a deliverable: MediaInfo versus the spec, loudness reading and checksum; or a disc image: plays from first-play to the main title and back to the menu in a software player |
| check | smoke cell, plus the changed menus, titles or streams, plus the spec comparison on the changed files |
| full | pairwise over platform or player × region × audio and subtitle stream × display mode × language |
| release | every platform or player in the matrix, every menu button and every stream, region and format checks on real players, full play-through, checksums on the final master, human checks |

Dimensions: TV platform and OS version (and the oldest model supported); remote type (basic IR, voice remote, D-pad only, game controller); display (1080p, 4K, HDR or not, 4:3 and 16:9 TVs); for discs: player type (stand-alone, PC software, game console, portable), disc type (DVD-5, DVD-9, BD-25, BD-50), region (DVD 1 to 6 and all; Blu-ray A, B, C), video standard (NTSC or PAL), display mode (16:9, 4:3 letterbox, 4:3 pan and scan), audio and subtitle language settings of the player; for files: container and codec, frame rate, loudness standard, caption format, language.

**Disc pass order (from DVD-vendor practice).** Build intake (BAT, then BVT of the disc image or folder) → full pass against the test plan or exploratory charters → regional and player checks → bug verification with regression around each fix → release-candidate pass → delivery checks and master checksums → go or no-go recommendation to the owner [1][2].

## Check catalogue

### Build intake and verification (files and discs)
- [high · auto] Verify the delivered package: file list, names, sizes, version or build ID, timestamps and checksums against the manifest and the previous build → everything present, nothing extra, nothing from another version or language (the build verification test) [1] {smoke}
- [high · auto] Compute SHA-256 or MD5 of every master file and disc image, copy to a second location and recompute → hashes match the manifest and each other; the checksum file is delivered with the files {smoke}
- [high · agent] Build acceptance: open or play the delivery from the start (disc image in a software player, file in a player, TV app on an emulator) → starts and reaches the main content without error; if it fails the build is rejected and nothing else runs {smoke}
- [medium · auto] Check names against the naming convention (no spaces or special characters unless allowed, correct language code, version or date, extension, case, length limits) → every file matches the spec's pattern
- [medium · auto] Check the delivery metadata: title, language tags, track names, chapter names, creation tool and copyright text in the container → match the spec; no placeholder, "untitled" or an internal project name

### Video technical checks (files and disc video)
- [high · auto] MediaInfo or ffprobe against the spec: container, codec, profile and level, resolution, frame rate, scan type, bit depth, chroma subsampling, bitrate → every value matches the spec exactly {smoke}
- [high · auto] Check aspect ratio: pixel aspect ratio and display aspect ratio flags, any letterbox or pillarbox bars, anamorphic flags (a 16:9 DVD is 720×480 or 720×576 anamorphic with a 16:9 flag), and 2.39:1 content in a 16:9 frame → picture is not stretched or squashed; bars are black and symmetric; the flag matches the picture
- [high · auto] Check colour: primaries, transfer and matrix (BT.709 for HD; BT.601 for SD; BT.2020 with PQ or HLG for HDR), range (limited or full) and HDR metadata → tagged correctly and consistent with the spec; no washed-out or crushed picture from a range mismatch
- [medium · auto] Check frame rate and cadence: constant frame rate, no dropped or duplicate frames, correct pulldown or none, interlaced field order for interlaced material (`idet`) → matches the spec; no judder from a wrong conversion
- [medium · auto] Check start timecode, duration, and the layout of the programme (bars and tone, slate, black, programme, tail) → matches the spec (many clients want a specific start timecode and head and tail lengths); audio and video durations agree within a frame
- [medium · auto] Scan for black frames, freeze frames, flash frames, dropouts, banding, blocking and out-of-gamut levels (`blackdetect`, `freezedetect`, `signalstats`, `qctools`) → none at unexpected places; each detected one is explained or fixed
- [medium · human] Watch the whole programme once at full screen on a calibrated display → no visible compression artefacts, wrong crop, cut-off titles, wrong or missing shots, burned-in subtitles in the wrong place
- [medium · auto] Check safe areas for titles and captions (action and title safe, as defined by the client) and the active picture area for cropped edges or edge junk (`cropdetect`) → text stays inside the spec; no black lines or jaggies at the edges
- [medium · auto] Check the HDR and SDR versions are consistent (same edit, same duration, correct metadata, no tone-mapping errors) → versions match except for grade

### Audio technical and loudness
- [high · auto] Measure integrated loudness, loudness range and true peak on the final mix (ffmpeg `ebur128`, a loudness meter) → within the client's spec; EBU R128 targets -23 LUFS integrated with a maximum true peak of -1 dBTP; ATSC A/85 targets -24 LKFS (a tolerance of 2 dB is commonly given) and a true peak of about -2 dBTP; tolerances differ between sources, so use the client's numbers [5][12] {smoke}
- [high · auto] Check channel layout and track order (stereo, 5.1 order such as L R C LFE Ls Rs, stereo downmix, M&E stems), sample rate (often 48 kHz) and bit depth → matches the spec; each channel carries the right content (play a tone per channel)
- [medium · auto] Check sync: lip-sync and sound effects against picture on slate and on programme; check any drift over the full length → audio and video aligned within the allowed tolerance at start, middle and end
- [medium · auto] Check silence, dropouts, clipping, DC offset, phase problems and mono-compatibility of stereo (sum to mono and re-measure) → none unexplained
- [medium · auto] Check dialogue-gated loudness where the spec asks for it, and each language track separately → each track meets the target; a dub is not much louder or quieter than the original
- [medium · human] Listen to the full programme on headphones and a TV speaker → no hiss, pops, wrong takes, missing effects or music cuts; dialogue intelligible
- [medium · auto] Check the audio streams on discs (Dolby Digital, DTS, LPCM; bitrate, channel count, language flag, default stream) → each stream plays; the language tag matches the audio

### Captions and subtitles
- [high · auto] Validate each caption file with the format's checker (Subtitle Edit, TTML or EBU-TT-D validator, SCC parse) → parses without errors in the format named in the spec (SRT, WebVTT, SCC for CEA-608, TTML or IMSC, EBU STL) [6][7] {smoke}
- [high · auto] Check timing against the spec: in and out times, minimum and maximum duration, gaps between cues, overlaps, and reading speed (characters per second) → within the client's limits; cues don't overlap; no cue past the end of the programme
- [high · auto] Check line length, line count, line breaks, character set and special characters (music notes, accents, quotes, right-to-left markers), and speaker labels or sound descriptions → conform to the spec; no mojibake; no broken characters in the player
- [high · agent] Burn the captions into a test render, or play them in the target player, and compare with the audio at the start, middle and end → in sync with the speech; no drift
- [medium · auto] Check frame rate and timecode conversions: SCC and drop-frame versus non-drop-frame timecode (29.97 DF), 23.976 versus 24, a start offset of 01:00:00:00 → captions don't drift or shift by a fixed offset
- [medium · agent] Check forced narrative subtitles (foreign dialogue or on-screen text) and SDH or CC differences; check the default on and off states per the spec → the right track appears at the right time; flags set correctly
- [medium · agent] Check position, colour, font and background for readability against bright and dark shots, and clash with burned-in text → readable; moves to avoid titles where the spec asks {a11y}
- [medium · human] Read all subtitles in each language against the script or audio → accurate, no typos, correct names and terms, appropriate line breaks (a native speaker for each language)

### Smart TV app: navigation and focus
- [high · agent] Launch the app on each platform's emulator or device, then navigate every screen with the D-pad only (Up, Down, Left, Right, OK or Select, Back) → every control reachable; the focus moves to the nearest sensible item; no focus lost or trapped {smoke}
- [high · agent] Check focus states: the focused item is clearly highlighted (a visible ring or scale), distinct from selected and pressed states, at 10-foot distance, in every theme → focus always visible; nothing focuses off screen {a11y}
- [high · agent] Press Back from every screen, dialog, player and deep link, and at the root → returns one level; at the root it exits or asks as the platform requires; never exits unexpectedly from a dialog or loses state
- [medium · agent] Navigate quickly: hold a direction, rapid key presses, long lists, grids with unequal rows, and a list that loads while moving → no skipped, doubled or lost key presses; the position is kept when returning to a list
- [medium · agent] Test the voice and mouse-like pointers where supported (Magic Remote on LG, voice search) → work or degrade gracefully; the pointer hides when the D-pad is used
- [medium · agent] Check text, icons and layout at 1080p and 4K, on overscan and safe areas, with the TV's large-text and high-contrast settings → no cut-off or tiny text (readable from about three metres); safe margins respected {a11y}
- [medium · agent] Check keyboard and text entry (on-screen keyboard, voice, phone as keyboard), including login by code or QR link to a phone with a test account → each way works; entry is quick enough; no real passwords typed by an agent
- [medium · agent] Check the app's first launch, sign-in flow and profile selection, and sign out → each flow works with only the remote; test accounts only

### Smart TV app: playback, DRM and lifecycle
- [high · agent] Play a test title (the app's own test content or a known sample): start, pause, resume, seek forwards and back, fast forward, rewind, end of title, next episode, subtitles and audio track selection → each works; the position and time are accurate; the controls match the platform's media keys {smoke}
- [high · agent] DRM playback with vendor test content only (Widevine, PlayReady, FairPlay test streams and licences): play, seek, change quality, resume after suspend; blocked on a test device without the right DRM level → protected content plays on supported devices with a clear message on unsupported ones; no clear-text keys in logs or requests {security}
- [medium · agent] Adaptive streaming: throttle the network down and up, drop it, and restore (DASH or HLS) → quality steps down without freezing for long; buffering UI appears; playback recovers; ads and credits handled
- [medium · agent] Captions and audio: turn on captions in the app and in the platform's accessibility settings, change language, style and size → captions appear, follow system style where supported, and survive seeking {a11y}
- [high · device] Screensaver and standby: pause for longer than the screensaver time, and let a video play through it → the screensaver doesn't start during playback; after pause it starts as expected; resume restores position
- [medium · device] Suspend, resume, power off and on, switch inputs and return, and HDMI-CEC wake-up → the app resumes in the same place or restarts cleanly; no black screen or frozen audio
- [medium · device] Network loss, Wi-Fi switch and a slow connection during playback and while browsing → a clear message and retry; no crash
- [medium · auto] Measure app launch time, screen-to-screen time and memory on the oldest supported TV → within the platform's limits and the stated targets; no leaks over a long session
- [medium · agent] Deep links, voice commands ("play X") and launching from the platform home screen and recommendations row → open the right content; unknown content gives a clear message
- [medium · device] Check 4K, HDR (HDR10, Dolby Vision, HLG) and audio passthrough (Dolby Atmos) on a supporting TV and a non-supporting one → falls back correctly; no wrong colours or silence

### DVD-Video and Blu-ray: menus, navigation and structure
- [high · agent] Insert the disc image or disc: from first-play, check the first thing that happens (warning, logo, menu or the title) → matches the menu map; unskippable items (such as legal warnings) can't be skipped and others can {smoke}
- [high · agent] Walk the whole menu tree from the menu map: every button on every menu, with the remote's up, down, left and right and OK → each button is reachable by D-pad routing (no dead ends or buttons that can't be reached), activates the right target, and the highlight and activate colours show correctly
- [high · agent] Check button routing wraparound and default buttons: the first highlighted button on entering each menu, behaviour at the edges, returning to a menu after a title ends or after pressing Menu → the highlight is on the expected button; "return to the last used" works where designed
- [high · agent] Remote keys during playback: Menu (root menu), Title (title menu), Top Menu (Blu-ray pop-up), Return, Next and Previous chapter, Stop, Resume, Search, Angle, Audio, Subtitle → each does what the spec says; keys that are blocked (user operation prohibitions) are blocked only where intended
- [high · agent] Play All and Play Title: play from the menu to the end of each title and across all titles → plays all the content in the right order; at the end returns to the right menu or stops as specified; no extra black, freeze or stutter between items
- [high · agent] Chapter points: step through every chapter with Next and Previous, and from the chapter menu → each chapter starts on the right frame with no black or glitch; chapter count, names and times match the client's list (check against the IFO or the playlist); chapters are on keyframes
- [high · agent] Audio streams: switch through every audio stream (language, format, commentary) by remote and from the menu, before and during playback → the right stream plays; default stream follows the spec and the player's language setting; each stream's label matches its audio {smoke}
- [high · agent] Subtitle streams: switch through each subtitle track, turn off, and test forced subtitles with subtitles off → correct language; timing right; forced subtitles appear automatically only where they should; the choice persists across chapters as specified
- [medium · agent] Check menu presentation: motion menu loops and loop points, menu audio, transitions, highlight shapes and colours, text legibility on a 4:3 and 16:9 TV, and button safe areas → no loop glitch or audio pop at the loop point; nothing cut off by overscan; text readable
- [medium · agent] Check the display modes: set the player to 16:9, 4:3 letterbox and 4:3 pan and scan → picture and menus look right in each; a 16:9-only disc handles the 4:3 setting as intended
- [medium · agent] Check setup and special menus: language setup, audio setup, bonus features, trailers, easter eggs, credits and legal text; each of their buttons and returns → work; no stub button or dead link
- [medium · agent] Check resume and last-played memory: stop and press Play, eject and reinsert (on a real player), and change language mid-title → resume works; the memory doesn't send the player to a wrong place
- [medium · agent] Check trailers, previews and bonus items: play each, skip, and return → correct item; aspect ratio and audio correct; the exit returns to the right menu
- [medium · agent] Seamless and multi-angle content, branching and layer break (dual-layer discs): play across the layer change and the branch points on a real player → no visible or audible glitch beyond the spec; the layer break sits at a sensible place (a black or scene change)
- [medium · auto] Check the structure in the IFO or the Blu-ray playlist tool: number of titles, PGCs, cells, streams and their flags, language codes, region flags, first-play and menu commands → match the spec and the menu map; no unused or orphan PGCs or titles; the disc fits the capacity with margin
- [medium · auto] Check the navigation commands and registers by stepping through with PgcEdit's virtual machine (DVD) or the authoring tool's simulator → no infinite loops, unreachable code or unintended jumps; registers hold the expected values (audio and subtitle selection)

### Discs: formats, regions and players
- [high · auto] Check the video standard (NTSC or PAL), disc type and capacity, volume label, file system and file listing against the spec → match; the disc image opens and is not oversized
- [high · device] Check region codes: the region flags of the disc (DVD regions 1 to 6 or all; Blu-ray A, B, C) against the spec, then play on players of the target and of a different region → plays on target-region players, is refused with a clear message on others, or plays everywhere if region-free [8][9]
- [high · device] Play on a matrix of real players: at least two stand-alone players of different makes and ages, a PC software player, a game console and a portable (as available), on at least two different TVs → plays from first-play to the end with menus and streams working; record the model and firmware per result
- [medium · device] Play on burned test discs (DVD-R, DVD+R, BD-R) and, where possible, on a replicated disc → reads without errors; the disc ID and label are correct; a read error is checked on several players before being called a disc fault
- [medium · auto] Check the bitrate and buffer limits: maximum video and total bitrate, VBV and the peak at menus and at layer breaks (BDInfo, authoring tool report, `ffprobe`) → within the format's limits; no player-dependent stutter at the peak
- [medium · human] Watch and listen through the whole disc once on a real TV and player the way a viewer would → no menu confusion, no wrong stream by default, nothing that looks unfinished
- [medium · agent] Check the packaging text against the disc: the running time, languages, subtitles, audio formats, aspect ratio, region and ratings logo on the label and the case → the printed claims are true for the disc (see `../features/media-playback.md`)

### Delivery
- [high · auto] Check the delivery package against the spec checklist item by item (files, formats, loudness, captions, naming, metadata, checksums, paperwork such as cue sheets, music clearance and QC report) → every item is present and passes; the list is attached to the report {smoke}
- [high · auto] Upload or copy to the delivery location (the client's test or staging location only) and verify checksums at the other end → hashes match; the transfer log has no errors; the right permissions
- [medium · auto] Check the QC report from the tool or the vendor against what you found by hand → no unexplained failures; each warning has a decision and a note
- [medium · agent] Check the version and language set: every requested language of audio, subtitles and captions is present, correctly labelled and the right version of the cut → complete; no stray older version
- [medium · agent] Compare against the previous delivery or approved master (frame-accurate where possible, checksums for unchanged files) → only the intended changes
- [medium · agent] Write the release-candidate report: tests executed, coverage, pass and fail counts, open issues, remaining risk, and a recommendation (not the decision) → the owner can make the go or no-go call from it [2]

## Gates

Deliverables are accepted or rejected by the client or the platform. The spec the client provides is the gate (`byo.md`). TV app stores (Samsung, LG, Google Play for Android TV, Amazon, Roku Channel Store, Apple) run their own reviews, which are human steps; read each store's current rules from the sources and the client. Block release when:

- Any value in the technical spec check fails (format, frame rate, aspect ratio, loudness, caption format, naming, checksums).
- Any disc button, menu, chapter, audio or subtitle stream is unreachable, wrong or missing on the test matrix, or the disc fails on a player in the required matrix.
- Region, standard or capacity doesn't match the spec.
- Any crash, freeze or hang, or lost state, on the target TV platform, or the Back or focus handling traps the user.
- Captions or subtitles drift, overlap or are missing in a required language.
- A checksum mismatch between the master and the delivered copy.
- The release-candidate pass isn't complete on the full matrix.

## Human-only checks

- [human] Watch and listen to the full programme on the final disc or file, on a real TV and speakers, start to finish → picture, sound, subtitles and menus all as intended; note any glitch with the timecode.
- [human] Press every remote button on every menu of the disc on a real stand-alone player, including Menu, Title, Return, Next, Previous and the coloured keys → no dead button, no wrong jump, nothing stuck.
- [human] Test the disc on your real players of different ages and makes, and on a region-different player if you have one → plays and behaves; record each result.
- [human] Check the layer break and the menu loop points by eye and ear → no visible freeze or audio glitch.
- [human] Have a native speaker read the subtitles and listen to the dub for each language → accurate and natural.
- [human] Use the TV app with the real remote on a real TV for 30 minutes, including playback, standby and the screensaver → focus is always visible, Back behaves, playback is smooth.
- [human] Submit to the TV platform store or deliver to the client with your own accounts and credentials → accepted. (Agents never submit or deliver to production locations.)

## Known pitfalls

- **Software player results aren't real-player results.** PC players ignore some navigation commands, user operation prohibitions and region settings, and are forgiving about timing. Mark real-player checks as device checks, and don't call a disc passed from VLC alone.
- **Authoring tool simulators differ from hardware.** A project that works in the tool's emulator can still fail on an old player (buffer, command timing). Test discs on hardware.
- **Loudness numbers depend on the standard and the measuring mode.** EBU R128 and ATSC A/85 differ in target and tolerance, and sources disagree on tolerance wording. Use the client's numbers, and say which meter, gating and window you used. Integrated loudness is measured on the whole programme, not a clip [5][12].
- **True peak isn't sample peak.** A file under 0 dBFS on a sample meter can exceed the true-peak limit. Measure true peak.
- **Frame-rate and timecode confusion.** 23.976 versus 24, 29.97 drop-frame versus non-drop-frame, and 25 for PAL: a wrong assumption makes captions drift. Check the spec and the file's rate before filing a sync bug.
- **MediaInfo and ffprobe can differ** on some fields (frame rate, aspect ratio from container versus stream, HDR tags). Cross-check with a second tool before filing.
- **Disc image size and capacity.** A DVD-5, DVD-9, BD-25 and BD-50 have different limits; check the spec's disc type. A burned-disc read error may be bad media: retry on another disc and player.
- **Chapter times in a tool are not always the same as the player's.** A chapter may snap to the nearest keyframe; check the chapter list rather than a frame-exact time unless the spec demands it.
- **TV emulators don't model remote, performance or DRM.** A smooth emulator proves nothing about a three-year-old TV. Test on the oldest supported device.
- **Platform key codes and Back behaviour differ** (Tizen, webOS, Android TV, Roku). Test each platform's own keys; "Back exits the app" at the root is often correct.
- **Burned-in text, forced narratives and region-specific cuts** can look like errors. Check the spec and the cut list first.
- **DRM test content and test licence servers** behave differently from production; don't test with real subscriptions or commercial content you don't own.
- **Don't deliver to or overwrite the client's production location.** Use a staging or test location.

## Sources

1. [Microsoft: build verification testing (BVT)](https://learn.microsoft.com/en-us/archive/blogs/imtesty/build-verification-testing-bvt) — BAT checks basic function; BVT checks the build's integrity (version, timestamps, CRCs, language and file names) (checked 2026-11-16)
2. [Microsoft: release readiness review](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc535141(v=technet.10)) — QA supplies evidence; management decides go or no-go (checked 2026-11-16)
3. [MediaInfo](https://mediaarea.net/en/MediaInfo) — technical metadata for video and audio files, JSON output (checked 2026-11-16)
4. [FFmpeg: ffprobe documentation](https://ffmpeg.org/ffprobe.html) — `-show_streams`, `-show_format`, `-show_chapters`, JSON output (checked 2026-11-16)
5. [FFmpeg filters: ebur128, silencedetect, blackdetect, freezedetect](https://ffmpeg.org/ffmpeg-filters.html#ebur128-1) — loudness and signal-analysis filters (checked 2026-11-16)
6. [W3C: Timed Text Markup Language 2 (TTML2)](https://www.w3.org/TR/ttml2/) — the TTML caption format (checked 2026-11-16)
7. [EBU Tech 3380: EBU-TT-D subtitling distribution format](https://tech.ebu.ch/docs/tech/tech3380.pdf) — EBU-TT-D subtitle format (checked 2026-11-16)
8. [Wikipedia: DVD-Video](https://en.wikipedia.org/wiki/DVD-Video) — structure (VIDEO_TS, IFO, VOB), navigation, streams and limits; secondary source, confirm limits in the authoring tool's documentation (checked 2026-11-16)
9. [Wikipedia: Blu-ray](https://en.wikipedia.org/wiki/Blu-ray) and [DVD region codes](https://en.wikipedia.org/wiki/DVD_region_code) — BDMV structure, region codes A, B and C, DVD regions 1 to 6; secondary sources (checked 2026-11-16)
10. [Android: TV app quality guidelines](https://developer.android.com/docs/quality-guidelines/tv-app-quality) — D-pad navigation, focus, Back, playback behaviour for Android TV (checked 2026-11-16)
11. [Roku: External Control Protocol (ECP)](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md) — sending key presses to a developer-mode Roku (checked 2026-11-16)
12. [EBU R 128: loudness normalisation and permitted maximum level](https://tech.ebu.ch/docs/r/r128.pdf) — programme loudness and true-peak limits; and [ITU-R BS.2434 report](https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BS.2434-2018-PDF-E.pdf) — comparison of loudness targets (-23 LUFS with -1 dBTP; -24 LKFS with -2 dBTP for A/85); tolerances vary by source, so confirm with the client's spec (checked 2026-11-16)
13. [Game Developer: build acceptance and the QA pipeline](https://www.gamedeveloper.com/production/introducing-the-quality-assurance-pipeline) — find, report, assign, fix, regress; classes A to D (checked 2026-11-16)
