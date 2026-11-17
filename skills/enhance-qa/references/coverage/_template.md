---
module: example-module        # file name without .md; lowercase, hyphens
kind: platform                # platform | feature | gate
title: Example module
checked: 2026-11-16           # date the rules and links below were last checked
---
# Example module

One short paragraph: what this module covers, what it doesn't, and which modules usually go with it.

## Signals

Switch this module on when any of these are true. The scout checks them during recon.

- A file, dependency or config that proves the product is this kind (for example `package.json` depends on `react-dom`).
- Words in the README or docs that say so.

## Kickoff questions

At most three. Each must change what gets tested. Offer a best guess so the user can just say "go".

1. Question? (best guess: …)

## Drivers

Best first. For each: when to use it, how to observe cheaply, and what it can't do.

1. **Driver name.** When. How. Limits.

**Can't be driven here:** what becomes a human or device check, with the reason.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | the one most common cell |
| check | smoke cell, plus the cells the changed areas need |
| full | pairwise over the dimensions below |
| release | every cell, plus human and device cells |

Dimensions: list them (browsers, OS versions, screen sizes, locales, input methods, hardware).

## Check catalogue

Seeds the scout adapts into real checks for this product (with real names, data and expected text). Each line is `- [risk · type] what to do → what must happen`, or, when there's nothing to do but look, one statement of what must be true. Risk is high, medium or low. Type is auto, agent, human, device or gate. Optional tags go in braces, for example `{smoke}` or `{security}`.

### Area or quality characteristic
- [high · agent] Do something specific → the observable expected result {smoke}
- [medium · auto] Run the validator → exit code 0, no warnings

## Gates

Release-blocking criteria for this kind of product, or links to gate packs in `../gates/`.

## Human-only checks

Things an agent must never mark passed. Give exact steps so the user can do them in a few minutes.

- [human] Steps → what to judge

## Known pitfalls

False alarms to avoid, flaky areas, and platform quirks that waste time.

## Sources

Numbered, with the date each was checked.

1. [Title](https://example.com) — what it supports (checked 2026-11-16)
