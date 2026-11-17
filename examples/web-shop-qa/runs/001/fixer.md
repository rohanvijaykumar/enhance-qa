# Fixer notes, run 001, build 1

BUG-001 → fixed in 90caf61 (no suite; halo ORD-005, ORD-004, ORD-001, SEC-001)
BUG-003 → fixed in 85ed602 (no suite; adds the esc() helper; halo SHOP-003..006, SEC-003, SEC-009)
BUG-004 → fixed in de26bcf (no suite; halo AUTH-001, AUTH-013, CART-010, every sign-in redirect, SEC-004)
BUG-006 → fixed in b962a9e (no suite; halo AUTH-001..004, SEC-008)
BUG-007 → fixed in 7e646fa (no suite; halo AUTH-004..007, AUTH-001)
BUG-008 → fixed in 94e3604 (no suite; halo AUTH-010, SEC-007, all signed-in pages)
BUG-009 → fixed in 3a8af6f (no suite; halo ACCT-002..004, CHK-005, CHK-001)
BUG-010 → fixed in 3befb1a (no suite; halo CART-003..006, CHK-002, header count)
BUG-011 → fixed in cc5403b (no suite; halo CART-006, CART-007, CART-009)
BUG-012 → fixed in 610288c (no suite; same commit as BUG-013; halo CART-001, CART-002, CART-008, SHOP-002, CHK-001)
BUG-013 → fixed in 610288c (no suite; same commit as BUG-012; halo CART-001, CART-012, CHK-001, CHK-007)
BUG-014 → fixed in b7edc45 (no suite; box now reads "0 reviews"; halo SHOP-007, SHOP-008)
BUG-019 → fixed in c90c0e0 (no suite; halo CHK-001..005, ORD-001)
BUG-020 → fixed in ee89737 (no suite; halo AUTH-005, AUTH-007..009, A11Y-001)
BUG-018 → fixed in 037f1e8 (no suite; desktop widths unchanged; halo A11Y-004, PAGE-004, CART-003, Admin table on phones)
BUG-017 → fixed in 41a7805 (no suite; halo PAGE-002)

## How the fixes were proved
- Checks: no test suite, type check or linter in the project. `node --check server.js static/app.js` passed after every change.
- Each bug: its steps (plus the edge cases listed in its fix notes) were run with curl against my own fresh `PORT=4311 node server.js`, restarted between two runs. Both runs gave the expected result before each commit. BUG-014 and BUG-018 were checked in headless Chrome: BUG-014 by the DOM text and console log, BUG-018 by measuring scrollWidth with the cart page in 390px and 1280px iframes.
- Before fixing, all 16 bugs reproduced on the unfixed code with the same checks (BUG-018: scrollWidth 620 at 390px).
- Final regression: all 16 bugs' checks together on HEAD 41a7805, two fresh-server runs, 234 checks, 0 failures, and nothing in the server's error log.
- The QA instance on port 4310 was not touched. My 4311 copies are all stopped.

## Things for the lead and verifier
- Commits touch only server.js, static/app.js and static/style.css. The user's uncommitted files (.claude/skills/enhance-qa/references/workflow.md, .claude/skills/enhance-qa/scripts/qa.mjs, .gitignore, qa/) were never staged.
- BUG-012 and BUG-013 share one commit (610288c). Its message names BUG-012, and its body says it also fixes BUG-013.
- I only escaped output where a bug needed it: the search heading, the login `next` value, and the address on /account and /checkout. Other user-controlled output is still unescaped and outside this batch: the signup name in "Hi <name>", shipTo on /orders/:id, and the emails on /admin.
- New user-facing text (from each bug's Expected or prompt): "An account with this email already exists", "Enter a valid email address", "Please enter a Ship to address", "Your cart is empty. Continue shopping". The reviews box now says "0 reviews" instead of hanging on "Loading reviews…".
- Not touched, as instructed: BUG-002, BUG-005, BUG-015, BUG-016.
- Process note: once during setup my own 4311 server was left running after a piped check got cut short. I found it by its command line and stopped it. Port 4310 (pid 16836) was never touched.
BUG-021 → fixed in 7b9f36a (no suite; halo /account heading, /orders/:id, checkout prefill; /admin untouched pending BUG-002)
