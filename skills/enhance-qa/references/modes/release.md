# Mode: release

**When:** the user says "release", "final", "ship", "go/no-go", or tags a release candidate. The output is a go/no-go report. The best verdict is **"Ready for your approval"**, never "go": the user decides.

## 1. Freeze

1. `qa snapshot` gives the release-candidate build.
2. Record its build number, commit and tree in the run file.
3. Any code change after this point means a new candidate. Say so if the working tree changes during the pass, and finish the report against the frozen build.

## 2. Full regression

Run `modes/full.md` on the candidate build. Order:
- smoke;
- every high-risk check;
- every regression check;
- the rest.

## 3. Release gates

1. For each gate in the plan (`gates:`), load `references/coverage/gates/<gate>.md`.
2. **Re-check its source links:** fetch each and compare with the "checked" date. If a rule changed, note it in the report, and update the pack only if the user agrees.
3. Run its `auto` and `agent` lines.
4. List its `gate` and `human` lines with exact steps.

Web products with a production URL get `gates/web-launch.md`, run against the deployed URL (read-only, except what the user does themselves).

## 4. Delivery checks

What actually ships, checked as a user receives it:
- installers and packages from a clean machine or container;
- store builds, signatures and notarisation;
- version numbers and the changelog;
- download links;
- the docs' install steps;
- licence and third-party notices;
- the size of the download.

The platform modules list the specifics.

## 5. The human checklist

Every `human`, `device` and `gate` check that applies, in one list with exact steps and time estimates. These must be done (`pass-human`) or explicitly waived (`waived`, with the date) before the verdict can be "Ready for your approval".

## 6. Must-fix list

- Every bug that blocks release (`policies/severity.md`, "Release-blocking") goes on the must-fix list.
- In the `rc` stage, only must-fix bugs are fixed.
- Each fix means a new build and a fresh release pass over the changed areas, the must-fix checks and the smoke checks.

## 7. The go/no-go report

The run file's "Release" section, and the summary:

```
Release candidate: build 31 (commit 4f3a2c1, tag v1.2.0-rc.2)
Verdict: Not ready: 1 must-fix bug, 2 human checks pending
Must fix: BUG-044 (S1) checkout fails with a declined test card
Gates: Web launch 13/14 (L9 email deliverability: DKIM missing → needs you)
Human checks: 2 pending (real iPhone Safari, one real low-value purchase and refund, done by you)
Regression: 212/214 passed · 2 known S3 deferred by you (BUG-031, BUG-038)
Changes since the last release: 41 files in 6 areas; all six areas fully re-tested
Evidence: qa/runs/031-release.md
```

When nothing blocks:

```
Verdict: Ready for your approval. All gates passed, 0 open blockers, every human check done or waived
```

Never tag, publish, deploy or submit. Those are the user's actions.
