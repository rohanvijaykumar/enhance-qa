# Mode: bug (log something someone saw)

**When:** the user describes a problem: `bug "the export button does nothing on Safari"`, "a user says they can't reset their password", "this crashed for me".

## Process

1. **Restate it** as steps and an expected result, from the user's words. Ask one short question only if the steps are impossible to guess, such as which page or which command.
2. **Lock and pin the build,** then run the intake gate (smoke only).
3. **Check for an existing bug:** search `qa/bugs/` for the same symptom or area. If it's a known open bug, add the report to it ("also reported by the user on <date>"), bump the severity if warranted, and stop.
4. **Reproduce:** a fresh verifier (Job 1), up to 3 tries, plus the obvious variants (browsers, sizes, accounts) that match the report.
5. **Reproduced:**
   - file it with `source: reported`. Add `tags: [escaped]` if a real user hit it in a released version;
   - add a regression check to the area (`Tags: regression`, plus `escaped` for escapes);
   - if it's `fix-now` and a clear defect, run the fix flow (`modes/fix.md`) for this bug.
6. **Not reproduced:**
   - file it as `cant-reproduce`, with what was tried;
   - add a "needs you" item asking for the missing detail (browser, account, exact steps, a screenshot).
   It stays visible in STATUS until it's answered or closed.

**Escapes raise the area's risk:** one level for its checks, and more rotation (`policies/stages.md`).
