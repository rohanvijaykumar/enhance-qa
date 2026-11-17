---
run: 1
mode: setup
build: 1
commit: 995eec620829
head: 9ea795fde2e6
tree: 2dd28f6b150d
started: 2026-11-16T22:40
finished: 2026-11-16T23:25
budget: standard
verdict: Not ready — 2 S1 bugs wait on your decision (BUG-002 admin page, BUG-005 secret key)
interrupted: no
progress: all phases done (intake, test 5/5 batches, confirm, triage, fix 2 rounds, verify, report)
---
# Run 001 · setup · build 1

## Kickoff (non-interactive: defaults used, per the user's request)
1. What it is: Corner Shop, a small homeware web shop (plain Node http server, server-rendered HTML, no dependencies), v0.4.0
2. Stage: building toward launch → S1/S2 fixed now, S3 before release
3. I can test: Chrome (via Playwright) at desktop and phone width, plus curl. I can't test: Firefox, WebKit/Safari, real phones → human check PAGE-004
4. Test accounts: the two seeded users from the README (qa-user-a / qa-user-b @example.test); credentials kept in git-ignored qa/.state/accounts.env. No real emails, payments or customer data
5. Fixing: Balanced. Clear defects fixed, one commit each; behaviour, auth/permission, wording and secrets changes go to "Needs you"
6. Role files and CLAUDE.md/AGENTS.md note: skipped (user said skip)
7. Saved tests (replay) and after-change check: skipped (user said skip)
8. Budget: standard

## Scope
Full baseline (stage: building): all 70 checks in risk order, 8 exploratory charters, environments chrome-desktop and chrome-phone (390×844).
Estimate ≈ $6 API-equivalent, ~25 min; above confirm_over_usd ($2) but non-interactive, so the announced scope runs.
Environment: local server `node server.js` on http://localhost:4310, Chrome via Playwright 1.65.1, Windows 11.
Uncommitted changes included in the snapshot: .claude/skills/enhance-qa/references/workflow.md (modified), .claude/skills/enhance-qa/scripts/qa.mjs (deleted), .gitignore (new, from qa init). None are product files.
Separation note: the lead did the scout's recon and checklist itself (small single-file app); testers and verifiers are separate black-box subagents.

## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| A11Y-001 | pass | Every visible input named: login email/password; signup Name/Email/Password; reset Email; cart "Quantity for Ceramic mug"; checkout "Ship to"; account "Shipping address" | evidence/001/plans/a11y-001.json |  |
| A11Y-002 | pass | Clean run r3: Tab x4 reaches Email, Tab to Password, Tab to Sign in (outline auto, visible); Enter signs in (user A, URL leaves /login) | evidence/001/plans/a11y-002-r3.json |  |
| A11Y-003 | pass (auto) | `<html lang="en"` | evidence/001 (curl output) |  |
| A11Y-004 | fail 2/2 | At 390x844, /cart with one item: scrollWidth 620 > viewport 390 (horizontal scroll). Home, product, login, checkout are 390 wide, no overflow | evidence/001/a11y-004-a11y-004-cart.png, a11y-004-r1-a11y-004-cart-r1.png | C6 |
| ACCT-001 | pass | "Hi Blair", address "12 Oak Lane" | evidence/001/plans/acct-001.json |  |
| ACCT-002 | fail 2/2 | "Address saved" shown (?saved=1) but after reload address box value is "" | evidence/001/acct-002-after.txt |  |
| ACCT-003 | pass | /account as guest -> /login?next=/account | evidence/001/plans/acct-003.json |  |
| ACCT-004 | fail 2/2 | Saved "9 Pine Close"; Ship to is empty at /checkout | evidence/001/acct-004-checkout.txt, acct-004-end.png |  |
| AUTH-001 | pass | Lands on /; header shows Cart, Account, Orders, Sign out | qa/evidence/001/auth-001.out.txt |  |
| AUTH-002 | fail 0/2 (desktop), fail 1/1 phone | Wrong password: "500 Internal Server Error" instead of "Incorrect email or password" (POST /login 500) | evidence/001/auth-002-fail.png, auth-002-phone-fail.png, auth-002-curl.txt |  |
| AUTH-003 | pass | "Incorrect email or password" shown for unknown email (200) | evidence/001/auth-003.txt |  |
| AUTH-004 | pass | Uppercase email + trailing space signs in (lands /) | evidence/001/plans/auth-004.json |  |
| AUTH-005 | pass | /account shows "Hi QA New"; Sign out present | qa/evidence/001/auth-005.out.txt |  |
| AUTH-006 | pass | "Password must be at least 8 characters" | curl output (quoted) |  |
| AUTH-007 | fail 2/2 | Duplicate email signup not refused: 302 to /account, "Hi Dup". User A's original password still works; new password "longenough1" gives 500 | evidence/001/auth-007-curl.txt, auth-007-fail.png |  |
| AUTH-008 | fail 2/2 | "not-an-email" accepted in browser and by curl; lands on /account "Hi Bad" | evidence/001/plans/auth-008.json (reads in run output) |  |
| AUTH-009 | pass | After Sign out, /orders -> /login?next=/orders; header "Shop · Sign in · Sign up" | evidence/001/plans/auth-009b.json |  |
| AUTH-010 | fail 2/2 | After POST /logout (302), old sid still gets /orders 200 showing "Order #101" | evidence/001/auth-010.txt |  |
| AUTH-011 | pass | Same "Check your email / If that email has an account, we sent a reset link." for A and nobody@example.test | curl quoted |  |
| AUTH-012 | pass | /orders -> login?next=/orders -> lands /orders showing #101 | evidence/001/plans/auth-012.json |  |
| AUTH-013 | fail (charter) | see candidates C4, C5, C6 | evidence/001/auth-013-next.txt |  |
| CART-001 | pass | Item, qty 1, Cart (1), total 'Total: $12.00' (check text omitted the colon; not a product bug). Run 1's miss was the check wording | qa/evidence/001/cart-001-retry.out.txt |  |
| CART-002 | pass | One row, $24.00, badge 2 | evidence/001/cart-t2-curl.txt |  |
| CART-003 | pass | qty 3: line $36.00, Total $36.00, badge 3 | evidence/001/cart-t2-curl.txt |  |
| CART-004 | fail | qty=-2 shows "$-24.00", Total "$-24.00", badge -2. qty=0 leaves line at $0.00 qty 0 (not negative) | evidence/001/cart-t2-curl.txt |  |
| CART-005 | fail | qty= and qty=abc give "$NaN" line, "Total: $NaN", badge "NaN" | evidence/001/cart-t2-curl.txt |  |
| CART-006 | pass | Spoon removed, mug $36.00 remains, count 3 | evidence/001/cart-t2-curl.txt |  |
| CART-007 | fail | Empty cart shows the text "undefined" instead of "Your cart is empty"; Total $0.00, Cart (0). Same at 390x844. 1/1 retry-confirmed (desktop curl + phone browser) | evidence/001/cart-t2-curl.txt, t2-phone.out, t2-phone-cart007.png |  |
| CART-008 | fail | POST /cart/add productId=2 (out of stock) puts Linen tea towel $9.50 in the cart | evidence/001/cart-t2-curl.txt |  |
| CART-009 | blocked | waiting on a question. Observed: Walnut spoon qty 10 (stock 3) accepted, line $180.00, badge up to 13, no message | evidence/001/cart-t2-curl.txt |  |
| CART-010 | pass | Guest POST /cart/add -> 302 /login?next=/cart | evidence/001/chk-t2-curl.txt |  |
| CART-011 | pass | A's mug not in B's cart (B: empty). A's cart cleaned up | evidence/001/t2-ab.txt |  |
| CHK-001 | pass | "Thank you!", "is confirmed. Total $12.00.", "Cart (0)" after order. Page error "reviewCache is not defined" seen on /cart and /checkout | qa/evidence/001/chk-001.out.txt | C1 |
| CHK-002 | pass | Cart and Checkout both Total $42.00 (desktop curl and 390x844 browser) | evidence/001/chk-t2-curl.txt, t2-phone.out, t2-phone-chk002.png |  |
| CHK-003 | pass | /checkout with empty cart: "Your cart is empty. Continue shopping" link, no form | evidence/001/chk-t2-curl.txt |  |
| CHK-004 | pass | Browser: empty Ship to blocked, validationMessage "Please fill out this field." and stayed on /checkout. (Server side see C6) | evidence/001/t2-chk4-6.out, t2-chk-chk004.png |  |
| CHK-005 | pass | B's Ship to value="12 Oak Lane"; spoon removed afterwards, B cart empty | evidence/001/t2-ab.txt |  |
| CHK-006 | pass | Orders lists "Order #105 · $12.00" (own order; #104 was an accidental empty-address test order). Order #101 is not listed for a throwaway user, as briefed | evidence/001/chk006-t2.txt |  |
| ORD-001 | pass | "Order #101 · $24.00" listed; "Order #102" not shown | qa/evidence/001/ord-001.out.txt |  |
| ORD-002 | pass | "Order #101", "Ship to: Alex, 4 Elm Road", "Total: $24.00" | evidence/001/ord-002.txt |  |
| ORD-003 | pass | /orders 302 -> /login?next=/orders; /orders/101 302 -> /login; /api/orders/101 401 | evidence/001/ord-003.txt |  |
| ORD-004 | pass | 404 "Order not found", no B details | evidence/001/ord-004.txt |  |
| ORD-005 | fail | A gets 200 and JSON with "Blair, 12 Oak Lane" for /api/orders/102 | evidence/001/ord-005.txt |  |
| ORD-006 | pass | "No orders yet." for new user | evidence/001/ord-006.txt |  |
| PAGE-001 | fail 2/2 | Footer "Terms" → HTTP 404, title "Not found · Corner Shop", "Page not found" | evidence/001/page-001-fail.png, page-_terms.html | C1 |
| PAGE-002 | fail 1/1 | /pricing reads "Recieve your order"; /terms is 404, so it could not be read | evidence/001/page-_pricing.html, page-_terms.html | C5 |
| PAGE-003 | pass | Titles: "Shop · Corner Shop", "Ceramic mug · Corner Shop", "Sign in · Corner Shop", "Pricing · Corner Shop", "Privacy · Corner Shop" | evidence/001/page-_*.html |  |
| PAGE-004 | human-pending | Human check: needs your eyes (desktop + phone) |  |  |
| SEC-001 | fail | /admin as A (and a new customer) returns 200 listing all users' emails incl. user B | evidence/001/sec-001.txt |  |
| SEC-002 | fail | Pages in app map clean, but /admin lists B's email; /api/orders/102 shows B's name+address | evidence/001/sec-002.txt, sec-001.txt |  |
| SEC-003 | fail | Response contains literal `<b><b>bold</b><img src=x onerror=alert(1)></b>` unescaped | evidence/001/sec-003.html |  |
| SEC-004 | fail | next value injected unescaped into hidden input (`value=""><script>alert(1)</script>">`); POST /login with next=https://example.com answers 302 Location: https://example.com | evidence/001/sec-004.html |  |
| SEC-005 | fail | app.js line 2: STRIPE_SECRET_KEY = 'sk_test_...' (redacted), line 3 exposes it as paymentsKey | evidence/001/sec-005.txt |  |
| SEC-006 | pass | both traversal URLs 404 "Not found" | evidence/001/sec6a.tmp |  |
| SEC-007 | pass | Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax | evidence/001/sec-007.txt |  |
| SEC-008 | pass | bad JSON -> 200 "Incorrect email or password"; 20k URL -> 431 bare; no traces/paths | evidence/001/sec-008a.txt, sec-008b.txt |  |
| SEC-009 | fail | Charter: found the same S1 problems as SEC-001..005 (orders API, admin, XSS, next redirect, key); nothing further | qa/runs/001/tester-3.md |  |
| SHOP-001 | pass | Heading "Shop", 3 products with $12.00 / $9.50 / $18.00; no page errors | qa/evidence/001/shop-001.out.txt |  |
| SHOP-002 | pass | Home row "Linen tea towel $9.50 Out of stock"; product page shows "Out of stock", no "Add to cart" | evidence/001/shop-002-home.html, plans/shop-002b.json |  |
| SHOP-003 | pass | "Results for mug"; only Ceramic mug listed (URL /?q=mug) | qa/evidence/001/shop-003.out.txt |  |
| SHOP-004 | pass | "WALNUT" lists "Walnut spoon" | evidence/001/plans/shop-004.json |  |
| SHOP-005 | pass | "No products match your search." and no product links for "zzzz" | evidence/001/plans/shop-005.json |  |
| SHOP-006 | fail 2/2 | After searching "mug" the Search box is empty; `value=""` in server HTML | evidence/001/shop-006-search.html, shop-006-r1 run | C2 |
| SHOP-007 | fail 2/2 | Heading, $12.00 and "Add to cart" present, but the page raises "reviewCache is not defined" (Expect says no script errors). Same on the retry | qa/evidence/001/shop-007.out.txt, qa/evidence/001/shop-007-retry.out.txt | C1 |
| SHOP-008 | pass | HTTP 404, "Product not found", header and footer present | evidence/001/shop-008.html |  |
| SHOP-009 | pass (auto) | `curl /api/products` → 200, 3 items with id, name, price, stock | evidence/001/shop-009.txt |  |
| SHOP-010 | flaky 2/3 | Run 1 failed on my own bad expectUrl; runs 2 and 3 passed: "Back to the shop" → / | evidence/001/shop-010-r1*, plans/shop-010-r1.json |  |
| SHOP-011 | fail | Charter: reflected HTML in search (S1, BUG-003); search box empties (BUG-016); trailing-space search finds nothing (S4, not filed) | qa/evidence/001/shop-011-odd.html |  |

## Bugs
- New (21): S1 BUG-001, BUG-002, BUG-003, BUG-004, BUG-005 · S2 BUG-006, BUG-007, BUG-008, BUG-009, BUG-010, BUG-011 · S3 BUG-012, BUG-013, BUG-014, BUG-015, BUG-018, BUG-019, BUG-020, BUG-021 · S4 BUG-016, BUG-017
- Fixed and verified (17): BUG-001, 003, 004, 006, 007, 008, 009, 010, 011, 012, 013, 014, 017, 018, 019, 020 (build 2) and BUG-021 (build 3, found during verification of build 2)
- Waiting on you (3): BUG-002, BUG-005, BUG-015 (needs-decision) · Open, later: BUG-016 (S4)
- Fix commits on master (not pushed): 90caf61 85ed602 de26bcf b962a9e 7e646fa 94e3604 3a8af6f 3befb1a cc5403b 610288c (BUG-012 + BUG-013) b7edc45 c90c0e0 ee89737 037f1e8 41a7805 7b9f36a. No checkpoint commit was made: the only uncommitted work was in .claude/skills/ and was left untouched.
- Regression checks added: ORD-007, SHOP-012, SHOP-013, AUTH-014..018, ACCT-005, CART-013..016, PAGE-005, A11Y-005, CHK-008, SEC-010
- Not filed: CART-001's first miss (the check text said "Total $12.00", the page says "Total: $12.00"; check wording, not a bug); a search with a trailing space finds nothing (S4, charter note); whitespace-only name/password accepted at sign-up (S3 guess, tester 1 C8; not sent to the verifier this run — re-check next pass)

## Exploratory notes
- AUTH-013 (sign-in edge cases): found the duplicate-email, invalid-email and body "next" open-redirect problems. Not covered: double submit, back button after sign out.
- CART-012 / CHK-007 (money tour): found negative/NaN quantities and the unknown-product 500. Not covered: back button, two tabs, rapid UI clicks.
- SEC-009 (attacker's tour): confirmed SEC-001..005 findings; nothing further. Not covered: cart/update with other users' product IDs, checkout Ship to tampering (later covered by BUG-021 verification).
- SHOP-011 (browse/search): found reflected HTML in search and the empty search box.

## Signal
First run: no earlier reports to measure. 21 of 21 verifier-reproduced findings filed; 17 fixed and verified.

## Cost
| Role | Model | Agents | Tokens (total) | ≈ Cost |
|---|---|---|---|---|
| Lead (incl. recon + checklist) | session (opus) | 1 | ~180k | ~$2.00 |
| Testers | haiku ×2, sonnet ×3 | 5 | 345k | ~$1.00 |
| Verifiers | sonnet | 5 | 299k | ~$1.20 |
| Fixer | session (opus) | 2 | 202k | ~$2.40 |
| Total | | 13 | ~1.0M | ≈ $6.60 (estimate was ~$6) |

## Needs you
- [ ] BUG-002 Any customer can open /admin and see every user's email. Restrict it to admin-role users (recommended; note no seeded user is an admin), or remove the page?
- [ ] BUG-005 A Stripe secret key (sk_test_…) is in the public static/app.js. OK to remove it from the client (recommended)? Rotate it in Stripe if it was ever a real key.
- [ ] BUG-015 The footer "Terms" link is a 404. Send the Terms text to publish (recommended), approve a short placeholder, or remove the link?
- [ ] CART-009 A cart quantity above stock (10 Walnut spoons, stock 3) is accepted. Cap at stock (recommended), refuse with a message, or allow back-orders?
- [ ] BUG-016 The search box empties after searching. Keep the query in the box (recommended), or by design?
- [ ] New wording added by fixes (from the bugs' expected results): "An account with this email already exists", "Enter a valid email address", "Please enter a Ship to address", "Your cart is empty. Continue shopping", and product pages now show "0 reviews". OK, or reword?
- [ ] PAGE-004 (human, ~3 min): open http://localhost:4310 at desktop and phone width, browse a product, the cart and checkout. Does it look tidy and read well?

## Not covered
- Firefox and WebKit/Safari: not installed on this machine (Chrome only) → covered only by the human check PAGE-004 for now.
- Real phones; password-reset email delivery (no mail system in the repo).
- Charter gaps listed under Exploratory notes.
- The 17 regression checks were added after verification; they run from the next pass.
