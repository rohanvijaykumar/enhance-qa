# Mode: status

**When:** the user asks where things stand: "QA status", "what's open?", "are we ready?" without wanting a new pass.

## Process

1. `qa status --json`. If `qa/STATUS.md` is missing or older than the newest run file, run `qa status --write` first.
2. `qa ingest --json`. Mention any ticks or answers waiting to be applied, and offer to apply them; that needs no testing.
3. Answer in a few lines, from files only. No testing, almost no tokens:
   - the verdict and the last build tested;
   - open bugs by severity;
   - the "needs you" items;
   - the human checks pending;
   - whether code changed since the last tested build, and what a `check` would cost now (from `qa select --json`).
4. Point at `qa/STATUS.md` for the details.

Don't lock, snapshot or spawn anything.
