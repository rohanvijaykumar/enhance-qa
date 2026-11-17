---
module: playstation-nintendo
kind: gate
title: PlayStation and Nintendo certification (bring your own)
checked: 2026-11-16
---
# PlayStation and Nintendo certification (bring your own)

Sony's Technical Requirements Checklist (TRC) and Nintendo's lotcheck are under NDA. They are given only to approved developers through the platform portals. This pack doesn't contain them and must not be treated as them. It explains how to bring the user's own copy in with `../byo.md`, and lists a short set of generic certification-style checks that most console titles face. Every line in "Generic checks" is generic, not an official requirement. Passing them proves nothing about certification. Use with `../platforms/games.md`, `age-ratings.md` and `xbox.md`.

## Signals

- Console SDK or devkit files in the project (PlayStation SDK, Nintendo SDK, a middleware port such as a Unity or Unreal console module), or console targets in the build config.
- The plan names "PlayStation", "PS5", "Nintendo Switch", "lotcheck", "TRC" or "console certification".

## Kickoff questions

1. Does the user have the current TRC or lotcheck documents and test cases from the partner portal? (best guess: yes if they have a devkit; ask them to point to the files)
2. Which consoles and regions are targeted? (best guess: read the build config)
3. Should NDA wording stay out of the reports? (best guess: yes; paraphrase and keep the item numbers)

## Drivers

1. **Imported requirements via `../byo.md`.** Read the user's TRC or lotcheck file in full, make one check per testable requirement with its original number, and keep NDA text in the user's files only. Cheap; the document is the oracle.
2. **PC or editor build of the same game.** Covers logic checks for save data, error handling, user switching and input without a console (simulated events, mock platform layer). Screenshots at 1280×800 or less.
3. **Devkit or test kit.** The only way to check the real thing: suspend and resume, controller disconnect, network states, trophies or achievements on the platform, performance. Device. Agents can run scripted passes only if the user has set up the devkit tools and allows it.
4. **Partner portal.** Needs the user's login. Agents never type it.

**Can't be driven here:** consoles, dev kits, platform portals, certification itself, and the TRC and lotcheck text. All of that is device, gate or bring-your-own.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | generic checks on a PC build |
| full | imported items run on a devkit |
| release | full, plus the platform submission and certification |

Dimensions: console model and generation, region and language, signed-in users, online and offline, handheld and docked (Switch), controller types.

## Check catalogue

### How to import
- [high · human] User supplies the TRC or lotcheck document (file, paste or portal export) → the scout imports it by `../byo.md`: one check per requirement, original numbers kept, type gate or device, NDA wording not copied into reports
- [high · human] Record the document version and date in the plan → the report says which version was tested against
- [medium · human] When the platform sends a new version, import it again and match items by number → added, changed and retired items are listed

### Generic checks (not official requirements)
- [high · device] Suspend and resume (sleep mode, home button, quit-and-return) in menus, gameplay and loading → game returns to the same state with no crash {generic}
- [high · device] Pull the network at menus, in matchmaking and mid-match, then restore it → clear message, no crash, game recovers {generic}
- [high · device] Error handling for storage full, corrupt or missing data, disc or card removed, and failed online service → readable message, no hang {generic}
- [high · device] Save data: save, power off, load; save over an old save; interrupt a save → no corruption and a recoverable previous save {generic}
- [high · device] Save data is tied to the correct user, and a second user doesn't see it {generic}
- [high · device] User sign-out and user switching mid-game, and controller reassigned to another user → game follows platform behaviour and doesn't use the wrong profile {generic}
- [medium · device] Controller disconnect and low battery during play → pause and prompt to reconnect {generic}
- [medium · device] Trophies or achievements: names, descriptions, icons, count and unlock rules match the design, and none unlocks twice or by mistake {generic}
- [medium · device] Platform terminology in on-screen text and buttons uses each platform's own names for buttons, menus and features → no other console's names or button glyphs shown {generic}
- [medium · device] Age rating and legal text display where the platform needs them, and match the rating from the board for each region; see `age-ratings.md` {generic}
- [medium · device] Boot to menu time, load times and frame rate on the real target hardware in the heaviest scenes → no hitch or slowdown that the team hasn't accepted {generic}
- [medium · device] Handheld and docked mode switching (Switch) or rest mode (PlayStation) → resolution and UI adapt, no crash {generic}
- [medium · device] Voice chat, text chat and user-generated content show the platform's report and block controls where online features exist {generic}
- [medium · device] Languages and regions: each supported language displays without overflow, and the language follows the system setting {generic}

### Submission
- [high · gate] Run the platform's own pre-submission tools and the submission package checks → tools report no errors (done by a human with portal access)
- [high · gate] Submit in the portal and respond to feedback → certification result; human only

## Gates

The platform's own certification is the gate. Generic checks only reduce the chance of an easy failure.

## Human-only checks

- [human] Provide the NDA documents and say how they may be quoted. Agents never copy NDA text into public files.
- [human] Run the devkit passes and the portal submission with your own credentials.
- [human] Confirm which version of the requirements you are testing against.

## Known pitfalls

- Don't treat the generic lines as TRC or lotcheck items. Mark them `{generic}` and never quote an item number for them.
- Don't cite third-party "checklists" as official; they often garble the terminology.
- Don't paste NDA content into the QA reports or public issue trackers.
- A PC build proves logic only. Don't mark console behaviour as passed from it.
- Platform names, button labels and rules change by firmware and region. Check the current guidelines.
- Nintendo says publicly only that submissions are reviewed for safe play and conformance to its production standards. Sony has no public TRC text that could be verified.

## Sources

1. [Nintendo Developer Portal: the process](https://developer.nintendo.com/the-process) — public statement only; details are under NDA (checked 2026-11-16 via research note 2; not re-fetched this pass)
2. [Bring your own checklist](../byo.md) — how to import NDA checklists (internal reference)
3. Research note 2, section 5 (PlayStation TRC and Nintendo lotcheck): no public TRC text found; vendor summaries are secondary and are not used as requirements (checked 2026-11-16)
