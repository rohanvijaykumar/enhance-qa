---
name: verify
description: Checks a change before it's committed. Runs the project's checks and a fast enhance-qa check of what changed.
---
# Verify before committing

1. Run the project's own tests, type checks and linter.
2. Run a fast QA check of what changed: use the enhance-qa skill in after-change mode ("enhance-qa quick check of what changed"). It runs the smoke checks and the high-risk checks in the changed areas (at most 10), with a fast model, and reports possible problems without fixing or filing anything.
3. Report what failed or looks wrong before committing. Don't change qa/ files.

<!-- Add this section to an existing verify skill instead of replacing it:
## enhance-qa quick check
Run a fast QA check of what changed: use the enhance-qa skill in after-change mode ("enhance-qa quick check of what changed"), and report possible problems before committing.
-->
