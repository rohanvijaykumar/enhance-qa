---
module: steam
kind: gate
title: Steam release and Steam Deck Verified
checked: 2026-11-16
---
# Steam release and Steam Deck Verified

Pre-checks for releasing a game or software on Steam through Steamworks, and for the Steam Deck compatibility review. Agents prepare and pre-check. Steamworks uploads, the store page review, build review and release button are human steps. Use with `../platforms/games.md`, `age-ratings.md` and `../features/installers-updaters.md`.

## Signals

- The Steamworks SDK (`steam_api64.dll`, `steam_appid.txt`, Steamworks.NET, Facepunch.Steamworks, GodotSteam), `steamcmd` scripts (`app_build.vdf`), or Steam depot configs.
- The plan names "Steam", "Steamworks", "Steam Deck" or "playtest".

## Kickoff questions

1. Is there a Steamworks app and a store page already (draft is fine), and is Steam Deck Verified a goal? (best guess: read the repo; Deck status is optional)
2. Does the game use achievements, cloud saves, multiplayer or Steam Input? (best guess: read the code)
3. Native Linux build or Windows build through Proton? (best guess: read the depots)

## Drivers

1. **Build and depot checks.** `steamcmd +run_app_build` on a beta branch (human with the user's login), file listing of depots, a clean-VM install via the Steam client. Exact and cheap.
2. **Run with the Steam client on a Windows or Linux test machine.** Use Steam launch options and `-windowed`, logs under the game's folder. Screenshots at 1280×800 or less for visual checks.
3. **Steam Deck or a Linux machine at 1280×800.** Real controller, on-screen keyboard and Gamescope. A Deck is the real test; a Linux PC with a controller and 1280×800 window approximates it.
4. **Steamworks partner site.** Needs the user's login. Agents never enter Steam credentials.

**Can't be driven here:** the Steamworks partner site, Valve's build and store review, Deck Verified rating, real Deck performance and battery, real Steam Cloud conflicts across two accounts, and VAC or anti-cheat behaviour. These are human, device or gate checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used; this pack runs on `release` passes |
| check | store page and build checks |
| full | check, plus achievements, cloud and Input on a test account |
| release | full, plus Deck review checks and the human playtest |

Dimensions: Windows, Linux native or Proton, Steam Deck, controller types (Xbox, PlayStation, Switch, Steam Controller), first install versus update, online versus offline.

## Check catalogue

### Store page and build review
- [high · human] Store page has all required text, capsule art, screenshots and trailer at the sizes Steamworks asks for, and describes the real game → each asset slot is filled, no placeholder art (see Sources 2)
- [high · human] Store page content matches the build: no screenshots from other platforms or features not in the build, and AI-content disclosure and content survey answered truthfully → page is accurate
- [high · human] Content survey and age-rating inputs match the game; see `age-ratings.md` → answers are true
- [high · agent] The build uploaded to the default branch launches from a fresh install on a clean machine, with no missing redistributables → starts to the main menu {smoke}
- [high · agent] Launch options in Steamworks point to the right executables and arguments for each OS → each option starts the game; none points to a missing file
- [medium · auto] Depot contents contain no debug files, source, keys, `steam_appid.txt` or stray developer files → file listing is clean {security}
- [medium · auto] Steamworks SDK version is recent enough for the features used, and DLL matches the platform → game connects to Steam without errors in the log
- [high · gate] Submit the store page and the build for review in Steamworks → both approved; Valve reviews build and page (human only) (see Sources 2)
- [medium · gate] Coming soon page is live before release as Steam recommends, and the release date is set → page visible to testers

### Steam features
- [high · agent] Test with a test account: unlock each achievement in the game and check the Steamworks stats → every achievement unlocks once, has name, description and icon, and doesn't unlock by mistake (see Sources 5)
- [medium · agent] Achievement names and descriptions have no spoiler or typo problem, and hidden ones are marked on purpose → listing reads correctly
- [high · agent] Steam Cloud: save on machine A, then start the game on machine B (or a second Steam library) → the save appears; a conflict shows the Steam prompt and neither save is lost (see Sources 6)
- [medium · agent] Cloud quota and file paths in Steamworks match where the game writes → files sync, size within quota
- [medium · agent] Offline mode: start Steam offline then the game → starts and plays, or says clearly what needs the network
- [medium · agent] Overlay (Shift+Tab) opens and doesn't break input or rendering → overlay works in each graphics mode
- [medium · agent] Rich presence, leaderboards and multiplayer use Steam IDs and handle logged-out or banned states → no crash on failure
- [medium · agent] Steam Input: default controller layout works and a player can use the Steam Input remap screen → every action reachable (see Sources 3)
- [medium · agent] Language list on the store page matches the languages in the build → each listed language exists in the game

### Steam Deck Verified (optional)
- [high · device] Play the whole game with only the Deck's controls and the default controller layout → all content is reachable without changing in-game settings (Input) (see Sources 3)
- [high · device] Check on-screen button glyphs change when the active input changes, and no keyboard or mouse prompts show while using a controller → glyphs match the device
- [high · device] Every text field opens the on-screen keyboard through a Steamworks text API, or has a controller-only built-in entry → the player can type a name without a keyboard
- [high · device] Smallest on-screen text is at least 9 px tall at 1280×800 (12 px or more is the recommendation) → readable at arm's length
- [high · device] Default settings reach at least 30 fps at 800p on the Deck → frame-rate counter stays at or above 30 in the heavy scenes (Performance)
- [high · device] Game runs at a resolution the Deck supports; native 1280×800 is preferred, 1280×720 is recommended → no letterbox bugs, no resolution picker needing a mouse
- [medium · device] Launchers: the game doesn't make the player navigate a launcher, or if it does the launcher is fully controller-navigable → no mouse-only launcher (Seamlessness)
- [medium · device] No message that tells the player the Deck, its Linux software or its GPU is unsupported → no such dialog
- [medium · device] If the game runs through Proton: play the full loop and check anti-cheat and video cutscenes → no Proton-only blocking bugs, since these show the game as Unsupported until fixed (see Sources 3)
- [medium · device] Suspend and resume the Deck mid-game, and undock or change power mode → game continues or recovers
- [medium · gate] Request the Steam Deck compatibility review after a standard build review passes; choose the branch to test → review result is Verified, Playable, Unsupported or Unknown; a new review can be requested after changes; the rating doesn't change whether the game can be bought

### Playtest and release
- [medium · gate] If using Steam Playtest, create the playtest app, add testers and issue keys → a test account can join and install
- [medium · human] Beta branch install by two or more real people on varied hardware → crash reports and logs reviewed
- [medium · human] Release-day plan: price, regions, launch discount, and the branch set to default → matches the plan; done by the human
- [high · gate] Press "Release" in Steamworks → the game is live; human only

## Gates

Store page and build approved, no placeholder or wrong-platform content, and the Deck lines checked if a Verified rating is wanted. Valve's decisions are the gate; agents never submit.

## Human-only checks

- [human] Log in to Steamworks, upload with steamcmd, set the default branch and press Release. Agents never type Steam credentials or Steam Guard codes.
- [human] Play on a real Steam Deck for an hour, with the default layout. Judge: feel, readability, comfort, and whether anything needs a mouse.
- [human] Read the store page as a stranger. Judge: it sells the real game honestly.

## Known pitfalls

- Deck review rules and the review process change. The thresholds above come from Valve's current page; re-read it.
- A Linux PC with a controller isn't a Deck. Frame rate and text size need the real device.
- Steamworks calls fail quietly if `steam_appid.txt` is missing or Steam isn't running. Check the logs before filing.
- Test accounts have no purchase history, so achievements or DLC checks may need a key. Use Valve's test or key tools, not real purchases.
- A "Playable" Deck rating isn't a bug; it only means some criteria aren't met.
- Don't test Cloud sync with a real person's account.

## Sources

1. [Steam Deck compatibility review](https://partner.steamgames.com/doc/steamdeck/compat) — Input, Display, Seamlessness, Proton, Performance (30 fps at 800p), 9 px text at 1280×800, review request (checked 2026-11-16)
2. [Steamworks: releasing your game](https://partner.steamgames.com/doc/store/releasing) — store page and build review, release (not re-fetched this pass)
3. [Steam Input](https://partner.steamgames.com/doc/features/steam_controller) — Steam Input and glyphs (not re-fetched this pass)
4. [Steam Playtest](https://partner.steamgames.com/doc/features/playtest) — playtests (not re-fetched this pass)
5. [Steam Achievements](https://partner.steamgames.com/doc/features/achievements) — achievements (not re-fetched this pass)
6. [Steam Cloud](https://partner.steamgames.com/doc/features/cloud) — cloud saves (not re-fetched this pass)
