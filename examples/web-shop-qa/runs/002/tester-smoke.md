# Run 002 · tester smoke · area: auth, shop, cart, checkout, orders
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| AUTH-001 | pass | 9/9 steps; landed on / with Sign out, Account, Orders, Cart in header | evidence/002/AUTH-001.result.json | |
| AUTH-005 | pass | 8/8; landed on /account, "Hi QA New" and "Sign out" shown. Created throwaway user qa-new-20261116a@example.test | evidence/002/AUTH-005.result.json | |
| SHOP-001 | pass | 10/10; HTTP 200 on /; 3 li.product; prices $12.00, $9.50, $18.00 found. Script-error check not done (driver does not capture console) | evidence/002/SHOP-001.result.json | |
| SHOP-003 | pass | 7/7; URL /?q=mug; "Results for mug"; exactly 1 li.product; "Walnut spoon" absent | evidence/002/SHOP-003.result.json | |
| SHOP-007 | pass | 5/5; /product/1 titled "Ceramic mug · Corner Shop"; $12.00 and Add to cart visible. Console not checked | evidence/002/SHOP-007.result.json | |
| CART-001 | pass | 16/16; "Cart (1)", "Total: $12.00", qty read as "1". Cleanup: clicked Remove, "Your cart is empty", "Cart (0)" | evidence/002/CART-001.result.json | |
| CHK-001 | pass | 15/15; "Thank you!", "is confirmed. Total $12.00.", order ref read as "Order #103", "Cart (0)" after. Creates a real test-mode order for user A | evidence/002/CHK-001.result.json | |
| ORD-001 | pass | 9/9; "Order #101 · $24.00" listed, "Order #102" absent (the list also includes #103 from CHK-001) | evidence/002/ORD-001.result.json | |

Counts: 8 passed, 0 failed, 0 blocked, 0 not run. No retries were needed.

## Candidates
None from the checks.

## Charter notes
None (smoke cell only).

## Learned
- Plans are in qa/evidence/002/<ID>.json. Run with `set -a; . qa/.state/accounts.env; set +a; node .claude/skills/enhance-qa/scripts/drive-web.mjs <plan>`; the env must be loaded in the same command.
- Driver exit 0 is a pass. Output JSON includes `reads` for values read with `eval`.
- The driver does not capture the browser console. The "no script errors" parts of SHOP-001 and SHOP-007 are unverified and need a console-capable check.
- Cart state is server-side per user. CART-001 cleans up its item, but CHK-001 places an order for user A, so later runs need a restart for clean data.
- The cart total reads "Total: $12.00" with a colon, as qa/notes.md says.
- Not run this pass (not in this run's list): AUTH-002 through AUTH-018, SHOP-002, SHOP-004 to SHOP-013, CART-002 to CART-016, CHK-002 to CHK-008, ORD-002 to ORD-007.
