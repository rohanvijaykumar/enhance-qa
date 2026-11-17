# Run 001 · tester 0 · area: smoke (intake gate)
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| SHOP-001 | pass | Heading "Shop", 3 products with $12.00 / $9.50 / $18.00; no page errors | qa/evidence/001/shop-001.out.txt | |
| SHOP-003 | pass | "Results for mug"; only Ceramic mug listed (URL /?q=mug) | qa/evidence/001/shop-003.out.txt | |
| SHOP-007 | fail 2/2 | Heading, $12.00 and "Add to cart" present, but the page raises "reviewCache is not defined" (Expect says no script errors). Same on the retry | qa/evidence/001/shop-007.out.txt, qa/evidence/001/shop-007-retry.out.txt | C1 |
| AUTH-001 | pass | Lands on /; header shows Cart, Account, Orders, Sign out | qa/evidence/001/auth-001.out.txt | |
| AUTH-005 | pass | /account shows "Hi QA New"; Sign out present | qa/evidence/001/auth-005.out.txt | |
| CART-001 | fail 1/2 | Run 1 (throwaway user, literal "Total $12.00"): not found, the page shows "Total: $12.00". Run 2 with the colon form on a fresh user: pass, "Cart (1)" and total present. Cart shows the same "reviewCache" page error | qa/evidence/001/cart-001.out.txt, qa/evidence/001/cart-001-fail.png, qa/evidence/001/cart-001-retry.out.txt | C1, C2 |
| CHK-001 | pass | "Thank you!", "is confirmed. Total $12.00.", "Cart (0)" after order. Page error "reviewCache is not defined" seen on /cart and /checkout | qa/evidence/001/chk-001.out.txt | C1 |
| ORD-001 | pass | "Order #101 · $24.00" listed; "Order #102" not shown | qa/evidence/001/ord-001.out.txt | |

Counts: 6 passed, 2 failed (SHOP-007, CART-001), 0 blocked, 0 not run. Test throwaway users were signed up with qa-t0-* emails (no passwords recorded).

## Candidates
### C1 · Script error "reviewCache is not defined" on product, cart and checkout pages
- Check: SHOP-007 · Severity guess: S3 · Seen: 2/2 on SHOP-007 (also on CART-001 and CHK-001 runs)
- Steps: Signed out, open http://localhost:4310/ → click "Ceramic mug" → read the page errors.
- Expected: no script errors in the console (source: checklist SHOP-007, README browse).
- Actual: page error "reviewCache is not defined". The heading, price and "Add to cart" still render. Also seen after sign-in on /cart and /checkout flows.
- Evidence: qa/evidence/001/shop-007.out.txt, qa/evidence/001/shop-007-retry.out.txt, qa/evidence/001/cart-001.out.txt, qa/evidence/001/chk-001.out.txt

### C2 · Cart total label does not match the check's wording
- Check: CART-001 · Severity guess: S4 · Seen: 1/2 (literal wording failed, colon form passed)
- Steps: Sign up a new user → /product/1 → "Add to cart" → /cart → look at the total.
- Expected: "Total $12.00" (source: checklist CART-001, unquoted; may be a wording issue in the check)
- Actual: the total reads "Total: $12.00" (colon). Other text, including "Cart (1)" and "$12.00", matches.
- Evidence: qa/evidence/001/cart-001-fail.png, qa/evidence/001/cart-001.out.txt, qa/evidence/001/cart-001-retry.out.txt

## Charter notes
Not given a charter.

## Learned
- Base URL must be set in each plan (driver default is localhost:3000). Use "base": "http://localhost:4310".
- Locators that work: {"label":"Email"}, {"label":"Password"}, {"role":"button","name":"Sign in"}, {"role":"link","name":"Ceramic mug"}, {"label":"Ship to"}, {"role":"button","name":"Place order (test mode)"}, {"role":"link","name":"Checkout"}.
- After sign-up, the app lands on /account. Cart total text is "Total: $12.00".
- Throwaway users: emails qa-t0-* (run-specific). Account env vars were loaded from qa/.state/accounts.env; no secrets are written in this file.
- Plans and output are in qa/evidence/001/plans/ and qa/evidence/001/*.out.txt.
