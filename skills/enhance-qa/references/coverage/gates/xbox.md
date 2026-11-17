---
module: xbox
kind: gate
title: Xbox requirements
checked: 2026-11-16
---
# Xbox requirements

Pre-checks for a title going to Xbox through ID@Xbox or the Creators program, or for Xbox features on Windows (Play Anywhere). Xbox Requirements (XRs) are public in part: Microsoft Learn shows a requirements page (flagged as permissioned), and the full test cases need partner access. This pack lists only the public headline areas and tells the scout to import the user's own copy of the requirements with `../byo.md`. Anything the user can see only under NDA is bring-your-own. Use with `../platforms/games.md`, `age-ratings.md` and `microsoft-store.md`.

## Signals

- The Microsoft Game Development Kit (GDK), `MicrosoftGame.config`, `GameSave` or Xbox Services API use, or an Xbox target in Unity, Unreal or Godot export settings.
- The plan names "Xbox", "ID@Xbox", "Creators program", "XR" or "Play Anywhere".

## Kickoff questions

1. Are the user's own Xbox Requirements document and test cases available (partner portal)? (best guess: no; use the generic list below and ask the user to import theirs)
2. Which targets: Xbox console, Windows via the Store, or both? (best guess: read the GDK config)
3. Do you have a dev kit or retail console in dev mode? (best guess: no, so most device lines stay open for the user)

## Drivers

1. **Public Xbox requirements page and the user's imported copy.** Turn each testable requirement into a check by `../byo.md`, keeping the XR number. Paraphrase if the text is under NDA.
2. **Submission Validator.** Microsoft's tool for GDK packages; its logs are part of a submission. Run it on the packaged title (needs the GDK and partner access). Human-run if the user holds the access.
3. **Windows PC run of the GDK build.** Covers many logic checks (suspend and resume simulation, user sign-in, save data, network loss with a firewall rule or `clumsy`-style tool on your own test machine). Screenshots at 1280×800 or less.
4. **Dev kit or console in dev mode.** The only way to test Quick Resume, hardware, controller and real network. Device.
5. **Partner Center / Xbox partner portal.** Needs the user's login. Agents never type it.

**Can't be driven here:** the partner portal, certification, Quick Resume on console, real Xbox Live services and the final XR test cases. These are gate, device or bring-your-own checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | the generic checks that run on a Windows GDK build |
| full | check, plus an imported XR list run on a dev kit |
| release | full, plus Submission Validator logs and certification |

Dimensions: console model (Series X, Series S, previous generation if targeted), Windows, signed-in users (one, two, guest), online versus offline, controller types, display modes.

## Check catalogue

### Stability, suspend and resume (XR-001 area)
- [high · device] Run through the whole game, then suspend and resume at menus, in gameplay and during loading → game returns in the same state with no crash or hang; XR-001 covers stability including suspend and hibernate (see Sources 1)
- [high · device] Quick Resume where supported: resume after the console has played another game, and after a title update → state restores or the game restarts cleanly
- [high · device] Soak: play or idle for several hours → no crash, memory growth or frame drift
- [medium · agent] On a Windows GDK build, simulate suspend and constrain/resume events → app handles them without data loss

### Users, profiles and saves (XR-045, XR-052, XR-112 areas)
- [high · device] Sign out, switch user and remove a controller's user mid-game → the title reacts as the requirements describe, with no wrong profile data (see Sources 1)
- [high · device] Save as user A, switch to user B → each user's save data is separate and tied to the right profile; XR-052 covers saves per user and roaming (see Sources 2)
- [high · device] Play on console A, then on console B with the same account → save data roams
- [medium · device] Update the title with an older save → old saves load (save compatibility across updates is in XR-003)
- [medium · device] Power loss during a save (pull the plug on a dev kit) → save isn't corrupted; the previous save remains

### Network and online (XR-074, XR-064 areas)
- [high · device] Remove the network cable or Wi-Fi during play, menus and matchmaking → clear message, no crash, return to a usable state; XR-074 covers loss of connectivity (see Sources 1)
- [medium · device] Reconnect after loss → online features recover without a restart
- [medium · device] If the game has sessions, join through the Xbox UI and by invite → joinable sessions work (XR-064) (see Sources 2)
- [medium · agent] Throttle and drop packets on a test network → multiplayer degrades gracefully; test on your own network only

### Achievements, content and age rating
- [high · device] Unlock every achievement on a test account; check names, descriptions, icons and gamerscore total → each unlocks once and matches the config (XR-055 area) (see Sources 2)
- [medium · human] If the game has user-generated content, check moderation and reporting tools → they exist and work (XR-018 area) (see Sources 2)
- [high · human] Age ratings come through IARC in Partner Center and the rating displays on the store page; see `age-ratings.md` → the rating matches the game
- [medium · human] Store page, trailer and screenshots match the shipped build → accurate

### Accessibility
- [medium · agent] Review the title against the Xbox Accessibility Guidelines (XAG) for text size, contrast, remapping, subtitles and audio cues → each relevant guideline is passed or marked n/a with a reason (see Sources 3)
- [medium · device] Check text is readable at TV distance and in each supported resolution and HDR setting → legible

### Submission
- [high · auto] Run Submission Validator on the final package and keep the logs → no errors; warnings explained (see Sources 2)
- [high · gate] Submit through the partner portal, with complete notes and a test account → certification passes; asterisked XRs have published test cases (see Sources 2). Done by a human only
- [high · human] Import the user's own XR document with `../byo.md`, then turn each item into a check with its original number → coverage report shows every item has a check

## Gates

All imported XRs pass on a dev kit, Submission Validator logs are clean and certification passes. The generic lines above never replace the real XR test cases.

## Human-only checks

- [human] Sign in to the partner portal, upload the package and submit. Agents never enter Microsoft credentials.
- [human] Play on a real console for a full session, with a second user and a network drop. Judge: it feels stable and fair.
- [human] Check the requirements version you tested against is the current one on the portal.

## Known pitfalls

- XR text and numbering change between versions (the public pages showed different versions on different sites). Always record the version.
- Some XR detail and test cases are under NDA. Never paste NDA text into reports; paraphrase and keep the number.
- A PC run can't prove a console result; mark those lines `device`, not passed.
- Dev-kit behaviour can differ from retail consoles in timing and performance.
- Don't use real Xbox accounts or children's accounts for tests; use test accounts.

## Sources

1. [Xbox Requirements (Microsoft Learn)](https://learn.microsoft.com/en-us/gaming/gdk/docs/store/policies/console/certification-requirements) — XR-001, XR-003, XR-074, XR-112; page showed v16.8 dated 13 November 2026 (XR numbers and titles confirmed; checked 2026-11-16)
2. [Xbox Requirements (devdocs)](https://devdocs.xbox.com/publishing/certification/xbox-requirements) and [top failing XRs](https://devdocs.xbox.com/publishing/certification/xr-top-failing) — XR-018, XR-045, XR-052, XR-055, XR-064; Submission Validator logs; asterisked XRs have published test cases (XR numbers and titles confirmed; checked 2026-11-16)
3. [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines) — pointer only; read the current guidelines (checked 2026-11-16; URL resolves)
