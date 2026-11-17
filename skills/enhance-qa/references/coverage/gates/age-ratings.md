---
module: age-ratings
kind: gate
title: Age ratings (IARC, ESRB, PEGI, USK, CERO)
checked: 2026-11-16
---
# Age ratings (IARC, ESRB, PEGI, USK, CERO)

Pre-checks for the age and content rating of a game or app. The rating itself is issued through a storefront questionnaire or a rating board, and a human enters the answers. Agents help the human answer truthfully by listing what the product actually contains. Use with `google-play.md`, `apple-app-store.md`, `microsoft-store.md`, `steam.md`, `xbox.md`, `playstation-nintendo.md` and `../features/privacy-consent.md`. Not legal advice.

## Signals

- A game or app is going to a digital storefront that asks for a rating (Google Play, Microsoft Store, Nintendo eShop, PlayStation Store, Steam, Apple App Store, itch.io, Epic).
- A physical or boxed release, or a console release in a region that needs a board rating.
- Content that triggers descriptors: violence, blood, sexual content, gambling, strong language, drugs, user-generated content, online interaction, in-game purchases, loot boxes.

## Kickoff questions

1. Which storefronts and regions? (best guess: read the plan or ask; this decides which system applies)
2. Does the game have paid random items (loot boxes), real-money purchases, user chat or user-generated content? (best guess: read the code and the store product list)

## Drivers

1. **Content inventory from the build.** A playthrough or a read of assets, scripts, string tables and store products, listing violence, blood, sexual content, language, drugs, gambling-like play, chat and purchases with concrete examples. Cheap. Needs the agent to look at the product, not guess from the genre.
2. **String and asset search.** `grep` for profanity and sensitive terms across localisation files; list store products and random-reward items from config. Exact.
3. **Storefront questionnaire (human).** The human answers the IARC or board questions using the inventory.

**Can't be driven here:** the rating bodies' final decisions, the physical-media rating process, and the storefront forms. The human completes them.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | not used |
| check | content inventory against current answers |
| full | check, plus every region and language |
| release | full, plus the certificate or rating shown on each store page |

Dimensions: storefront, region, language build, DLC and updates, the most severe content in any build or update.

## Check catalogue

### Before answering
- [high · agent] Build a content inventory covering violence, blood and gore, sexual content or nudity, language, drugs and alcohol, gambling-like play, fear, discrimination, online interaction, user-generated content, location sharing and purchases → each item has a concrete example from the build, or "none found"
- [high · auto] Search all language files for strong language and slurs, in every shipped language → list of hits with file and line; the strongest word is known
- [high · agent] List every in-game purchase, premium currency, random reward (loot box, gacha, card packs) and ad → each is named and shown with how a player gets it
- [medium · agent] List every online feature: chat (text, voice), friend lists, user-generated content, sharing of location and personal data → each is described, with the moderation tools
- [medium · agent] Check the most extreme content in the whole product, including hidden or late-game scenes, DLC and cheat or debug modes → included in the inventory

### IARC questionnaire (used by many digital storefronts)
- [high · human] Answer the questionnaire in each storefront's own developer console, using the inventory and honest answers → a certificate and ratings for each participating region are issued; one set of answers can be reused across participating stores via the IARC certificate (see Sources 1)
- [high · human] Compare the issued ratings and descriptors with the inventory → ratings are no lower than the content warrants; if a rating looks wrong, correct the answers rather than argue
- [medium · human] After any update that adds content (new levels, DLC, chat, purchases), answer the questionnaire again → rating still matches; the storefront may change it
- [medium · human] Store listing shows the rating and the descriptors the store gives, and they aren't removed or edited by hand → each region shows its own rating
- [medium · human] Note stores that don't take IARC (Steam uses its own content survey; Apple uses its own age rating questions) → each is answered separately (see Sources 5)

### ESRB (US, Canada, Mexico)
- [medium · human] For a boxed or console release that needs ESRB, check the submission and the content descriptors and interactive elements (in-game purchases, users interact, shares location) → rating shown on the box or store matches (see Sources 2)
- [medium · human] In-game purchases and random-item labels appear where the board requires → "In-Game Purchases" and "Includes Random Items" labels present when true

### PEGI (Europe)
- [medium · human] PEGI age and content descriptors (violence, bad language, fear, gambling, sex, drugs, discrimination, in-game purchases) match the content → descriptors are on the pack or store page (see Sources 3)
- [medium · human] Where PEGI applies, the paid random items and in-game purchases descriptors are used if true → shown

### USK (Germany) and CERO (Japan)
- [medium · human] Germany: check the USK age rating exists for physical release; online-only titles go through IARC and the rating is displayed by the store → rating shown (see Sources 4)
- [medium · human] Japan: console releases normally need a CERO rating and the Z category has extra rules; ask the platform holder → the rating or the exemption is written down (see Sources 6)
- [low · human] Other regions (Australia, Brazil, South Korea) are covered through IARC for digital stores; physical releases may need local boards → noted in the release plan

### Consistency with other declarations
- [high · agent] The rating answers, the store description, the age gate in the game and the privacy policy tell the same story about children and online features → no conflict (a game rated for adults can't promise child-safe features; a children's game can't carry adult ads)
- [medium · agent] If the app is for children, check ads, chat, purchases and data collection against child-protection rules; see `privacy-law.md` → no unsuitable ad, chat or tracking
- [medium · agent] Age gates and parental controls (where promised) work in a test account → under-age test account can't reach adult features
- [medium · human] Screenshots, trailers and key art follow the rating (nothing more extreme than the rating allows) → pass on review

## Gates

Ratings issued for every channel the product ships to, answers that match the content, and a re-answer after any content update. A wrong or understated answer can lead to removal, so it blocks release.

## Human-only checks

- [human] Log in to each store console and answer the questionnaires. Agents never enter store credentials or sign legal declarations.
- [human] Read the inventory against the issued rating. Judge: would a parent be surprised?
- [human] For boxed or console releases, handle the board's submission and fees.

## Known pitfalls

- The ratings are self-declared in IARC, but stores can change or remove them, so don't "optimise" answers to get a lower rating.
- IARC ratings display only on stores that licence IARC. The participating stores list changes. Check each store's own page.
- Steam and Apple use their own questionnaires, not IARC.
- The same game can get different ratings in different regions. That isn't a bug.
- Don't promise a specific rating. Report the answers and the issued result.
- Board rules, labels and descriptors change. Re-read the board's page before submission.

## Sources

1. [How IARC works](https://www.globalratings.com/) — one questionnaire through participating storefronts, certificate ID reuse, free to developers (checked 2026-11-16 via web search; site root linked because the old how-it-works page address no longer resolves)
2. [ESRB FAQs](https://www.esrb.org/faqs/) — ESRB and IARC participation (checked 2026-11-16 via a web search summary)
3. [PEGI](https://pegi.info/) — PEGI system and descriptors (not re-fetched this pass)
4. [USK](https://usk.de/en/) — USK and IARC (checked 2026-11-16 via a web search summary)
5. [Apple: upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) — updated age rating questions in App Store Connect from 31 January 2026 (checked 2026-11-16)
6. [CERO](https://www.cero.gr.jp/en/) — Japanese rating board (not re-fetched this pass)
