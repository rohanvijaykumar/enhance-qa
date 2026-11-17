# Stages and cadence

The first run always builds a baseline: impact-based regression needs one. How deep the baseline goes depends on the stage.

| Stage | First run | Everyday | Before release | Bug bar (fix now) |
|---|---|---|---|---|
| **prototype** | Light: smoke test, core flows, a few exploratory charters | `check` | n/a | S1 only |
| **building** (toward launch) | Full baseline | `check`; `full` at milestones and after wide changes | `release` | S1–S2 now, S3 before release |
| **near-release** (adopting late, many builds already done) | Full baseline at release-candidate depth, run in risk order so the most important checks finish first if time runs short | `loop` until the exit criteria are met | `release` | S1–S2, plus S3 in critical flows |
| **rc** (release candidate) | `release` | Must-fix only. A must-fix bug means a new build and a fresh release pass | — | The must-fix list only |
| **live** (shipping every few days) | Full baseline once | Per release: smoke, this release's fixes, the changed areas, new features, and a 15% rotation of the oldest-run checks, then a read-only `prod` smoke after deploy | `full` every 30 days, every 10 releases, or on a major upgrade | S1 as a hotfix; S2 next release |
| **hotfix** | — | Verify the fix, check around it, smoke | — | — |

## Detecting the stage

Signals, strongest first:
- the version number: 0.x suggests prototype or building; 1.0 or later with releases suggests live;
- git tags and GitHub releases;
- a changelog;
- deploy config and a production URL;
- store metadata (an App Store or Play listing, a Steam page);
- commit history (age, cadence, "release" or "hotfix" branches).

Put the guess in the kickoff message. The user confirms or corrects it, and it's saved as `stage:` in `qa/plan.md`. Re-check it at each `release` pass and when tags appear.

## Rotation

So every check runs regularly without running everything every time:
- `check` adds the oldest-run checks, up to `rotation:` percent of the checklist (default 15 on live products and 10 otherwise), chosen by `qa select`.
- At 15% per release, the whole checklist cycles about every 6–7 releases.

## Automatic escalation

Suggest a `full` pass when:
- the diff is wide: more than about 30% of files, a framework or major dependency upgrade, or build-system changes (`qa select` reports this);
- regression keeps finding bugs in one area, because defects cluster. Suggest a full pass of that area.

## Escaped bugs

Bugs that reach users ("escapes") are logged with `bug "…"`.
- Each one is reproduced, filed with the `escaped` tag, and turned into a regression check.
- Escape counts per area feed the risk ranking: an area with escapes gets its checks' risk raised one level, and more rotation.

## Exit criteria

The default for `loop` and for `release` readiness. Edit them as `exit_criteria:` in `qa/plan.md`.
- No open S1, and no open S2 in a core flow.
- Every high-risk check passed on the current build.
- Every fix verified.
- Every required human and gate check done or waived.
- A fresh pass over the changed areas found nothing new.
