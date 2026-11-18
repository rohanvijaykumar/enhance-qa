# Severity and priority

**Severity** is how bad the problem is for users. Testers propose it from this rubric, and the lead confirms it at triage.

**Priority** is when to fix it. It comes from the stage's bug bar (`stages.md`), and the user can change it.

## Severity rubric

| Severity | Meaning | Examples |
|---|---|---|
| **S1 blocker** | Stops a core task for many users, loses or exposes data, takes money wrongly, or is a security hole. No workaround | Can't sign up or log in; checkout fails; user A can read user B's data; crash on launch; data deleted on save; secret key in the bundle; installer fails |
| **S2 major** | Breaks an important feature or a common path, or seriously misleads, but a workaround exists or few users hit it | A wrong password shows a 500 page; search returns nothing for valid queries; export drops rows; a required flow broken at phone width; a missing permission check on a non-sensitive action |
| **S3 minor** | Works, but wrongly or awkwardly in a way users notice | A wrong validation message; a confusing empty state; a layout break on one browser; a slow but finishing action; a non-critical console error |
| **S4 cosmetic** | A small visible defect that doesn't change what the product does | Misaligned or clipped text, a minor typo outside the core flows, a wrong icon, inconsistent capitalisation |

Severity grades bugs only. A missing feature or a "nicer if" idea isn't S4, because it isn't a bug at all (`signal.md`, "Bugs, not wishes").

**Adjust up one level** when:
- it's in a core flow (the first-run path, the money path, the main task);
- it affects accessibility for people who rely on assistive tech;
- it's public-facing and embarrassing (the landing page, a store listing);
- it involves money, privacy or safety.

**Adjust down one level** when it needs an unusual setup that real users won't have.

## Priority

| Priority | Meaning |
|---|---|
| `fix-now` | Fix in this run or the next, per the stage's bug bar |
| `before-release` | Must be fixed or explicitly waived before the next release |
| `later` | Known; fix when convenient |

Default mapping by stage. The user's overrides in `qa/plan.md` (`bar_fix_now:`) win.

| Stage | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| prototype | fix-now | later | later | later |
| building | fix-now | fix-now | before-release | later |
| near-release | fix-now | fix-now | fix-now in critical flows, otherwise before-release | later |
| rc | fix-now only if on the must-fix list (any S1 is) | must-fix list only | later | later |
| live | fix-now (hotfix) | before-release (next release) | later | later |

## Release-blocking

A release pass can't reach "Ready for your approval" while any of these is open (not verified, waived or deferred by the user):
- an S1;
- an S2 in a core flow;
- any `before-release` bug;
- a failing high-risk check;
- a pending human or gate check that the plan marks required.

The user can waive anything in writing (`→ waive` in STATUS). The waiver is logged with the date.
