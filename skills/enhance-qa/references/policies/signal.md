# Signal, not noise, and independence

Noise is the main reason teams abandon QA tools. Google retires analysers whose findings developers don't act on more than 10% of the time. Hold this skill to the same bar.

## What reaches the user

1. **Only reproduced findings.** A tester's finding is a *candidate*. It becomes a bug only after the verifier reproduces it on the same build, with evidence. Exception: a severe finding (S1) that reproduced for the tester 2 of 3 times is filed at once and verified in parallel.
2. **Minor and above are reported; cosmetic (S4) findings are listed collapsed** in the run file and STATUS, not in the summary.
3. **Attack, don't lint.** Prove the problem instead of pattern-matching it. For example, read another test user's rows with the app's public key rather than reporting "anon key found in bundle"; submit the form twice rather than reporting "no idempotency key".
4. **One root cause, one bug.** Group symptoms with the same cause (same error, same failing call, same missing check) into one bug, listing every place it shows up. Mark later reports of it `duplicate` with `duplicate_of`.
5. **Plain language first.** Every bug opens with what a user would see and why it matters, then the steps and evidence, then a paste-ready prompt for the user's coding agent.
6. **Read the platform's own scanners where they exist** (Supabase Security Advisor, the Lovable, Bolt, Replit and Base44 scans, `npm audit` or `pip-audit`, Lighthouse, axe). Triage their findings with your own and never report the same thing twice. Say "also flagged by <scanner>" in the bug.
7. **Respect "not useful".** The user can mark any bug `not-useful` (a tag) or `by-design`. Don't file similar findings again; note the suppression in `qa/notes.md` under "Don't report". Track the share of reported bugs the user acts on (fixed, deferred or accepted) versus dismissed, in each run file. If dismissals exceed 10% over the last three runs, tighten the bar: report only S1–S2 until it recovers, and say so.

## Independence rules

- **Testers and the verifier never edit code or the checklist.** After each phase, the lead runs `qa gate`. Any change outside the role's allowed files is reverted and flagged.
- **Testers are black-box.** They use the product the way a user does and don't read its source. Only the scout reads code, to map the product. Error text the product shows (a stack trace on screen, a log line) is fair to report.
- **The fixer never edits the checklist, expected results or test assertions** to make something pass, and can't close bugs. If a fix needs an expected result changed, that's a question for the user.
- **Only the verifier closes bugs,** and it's always a fresh agent that neither found nor fixed the bug. Its prompt is neutral: the steps and the expected result, never the tester's or fixer's theory. It answers Verified, Not verified or Inconclusive.
- **Expected results are written before testing** and hashed at the start of every run (`qa hash --record`). `qa gate` fails if they change mid-phase.
- **Spot audits.** In `check` and `full` passes, the lead re-runs about 10% of passed checks (at least one) with a different tester. A disagreement is investigated; a tester that passed a failing check loses the benefit of the doubt for the rest of the run (its other passes are re-checked).
- **No evidence, no verdict.** Every result carries an observation: what was seen, the URL or screen, an exit code, a log line, a screenshot path. A failure always carries full evidence. A result without evidence is treated as "not run".

## Flaky results

- Retry a failure once. If it then passes, run it a third time.
- Record intermittent results as n/N (for example `fail 2/3`).
- File a bug when it reproduces 2 of 3 times, or at once if it's severe (S1).
- A check that flips between builds without related changes is tagged `flaky` in the checklist, and the lead looks for an environmental cause before filing anything.
- **Never make a flaky check pass** by waiting longer, adding sleeps or retrying until it goes green. Find the cause: test data, timing, environment, or a real race in the product (then it's a bug).
- **A check or replay that stays flaky with no cause found is retired,** with the reason written down. Don't leave it running to train everyone to ignore failures.

## The share of findings acted on

Each run file records, for the bugs reported in the previous runs: acted on (fixed, verified, deferred, accepted as known) and dismissed (`not-useful`, `by-design`, `wont-fix` because it isn't a problem). The lead reports the rate in the run file's "Signal" line. Aim for 90% acted on or better.
