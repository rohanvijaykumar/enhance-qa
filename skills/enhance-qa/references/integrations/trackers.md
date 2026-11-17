# Bug trackers (optional)

`qa/bugs/` is the source of truth. An outside tracker (GitHub Issues, Linear, Jira) can mirror it, but **only with the user's OK**, because it posts to an outside service (it's an outside effect). Ask once and remember the answer as `tracker:` and `tracker_sync:` in `qa/plan.md`.

## Export, the default when the user agrees

- `qa export csv` gives a CSV of the bugs that Linear and Jira can import.
- **GitHub Issues:** the lead drafts one issue per open bug, using:
  - the title;
  - the sections "What a user sees", "Steps", "Expected" and "Actual";
  - the evidence paths;
  - the "Prompt for your coding agent".

  Labels: `qa`, the severity and the area. The lead shows the user the list and the target repo, and files only after a clear yes, with `gh issue create`. Record the issue URL in the bug's front matter (`issue:`).

## Sync, only if the user turns it on

- On each run, new reproduced bugs get an issue, and status changes (`verified`, `reopened`) add a comment. Only for bugs QA files; issues the team writes by hand are left alone.
- Never close an issue that QA didn't open.
- Never edit issues outside the `qa` label.

## Importing

To bring existing issues into QA, the user names them or a label. The lead reads them, and each becomes `bug "…"` (`modes/bug.md`): reproduced, filed with `source: reported`, and linked back with `issue:`.
