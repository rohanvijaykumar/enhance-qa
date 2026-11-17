# Bug zoo: web-shop

Found 13 of 13 planted bugs (keyword match; review below). Filed: 21 bugs. Unmatched filings: 8.
Time: 2547 s · cost reported: 9.594337240000002 · turns: 85 · exit: 0

| Planted | Severity | Matched filing | Filed severity | Status |
|---|---|---|---|---|
| wrong-password-500 | S2 | BUG-006 A wrong password shows a 500 error page | S2 | verified |
| idor-orders-api | S1 | BUG-001 Any signed-in customer can read other customers' orders through the orders API | S1 | verified |
| admin-open | S1 | BUG-002 Customers can open the admin page and see every user's email | S1 | needs-decision |
| negative-qty | S2 | BUG-010 Cart quantity accepts negative, blank and non-numeric values | S2 | verified |
| empty-cart-undefined | S3 | BUG-011 Removing the last cart item shows "undefined" instead of "Your cart is empty | S2 | verified |
| pricing-typo | S4 | BUG-017 Typo on the Pricing page: \"Recieve\ | S4 | verified |
| terms-404 | S3 | BUG-015 The Terms page in the footer is missing (404) | S3 | needs-decision |
| search-xss | S2 | BUG-021 A name or Ship to containing HTML is rendered as HTML | S3 | verified |
| signup-empty-email | S3 | BUG-020 Sign up accepts an invalid email address | S3 | verified |
| console-error-product | S3 | BUG-014 Product pages throw a script error ("reviewCache is not defined") | S3 | verified |
| secret-in-bundle | S1 | BUG-005 A payment secret key is in the public JavaScript | S1 | needs-decision |
| checkout-bar-phone | S2 | BUG-018 The cart page scrolls sideways on a phone | S3 | verified |
| address-not-saved | S2 | BUG-009 Saving a shipping address doesn't keep it | S2 | verified |

## Filings that matched no planted bug (review: real extra finding or false alarm?)
- BUG-003 (S1, verified): Search text is injected into the page as HTML
- BUG-004 (S1, verified): The sign-in page's "next" value can inject script and send users to another site
- BUG-007 (S2, verified): Signing up with an email that already has an account creates a second account
- BUG-008 (S2, verified): Signing out doesn't end the session
- BUG-012 (S3, verified): An out-of-stock item can still be added to the cart
- BUG-013 (S3, verified): An unknown product ID breaks the cart and checkout with a 500
- BUG-016 (S4, needs-decision): The search box forgets the query after searching
- BUG-019 (S3, verified): An order can be placed without a Ship to address

## Final summary from the run

```
The setup and first full pass are done. Corner Shop isn't ready to launch yet: two serious security bugs need your decision before they can be fixed.

```
QA · Build 1→3 · setup (full baseline) · ~45 min
✓ 41 passed   ✗ 25 failed   ⏸ 1 blocked   👤 1 human        Verdict: not ready — 2 S1 bugs wait on your decision
Fixed and verified: 17 bugs (BUG-001, 003, 004, 006–014, 017–021), one commit each on master, not pushed
New, still open: BUG-002 (S1) any customer can open /admin and see every user's email
                 BUG-005 (S1) a Stripe secret key (sk_test_…) is in the public static/app.js
                 BUG-015 (S3) the footer "Terms" link is a 404
Needs you (2 min):
  1. BUG-002: limit /admin to admin users (recommended; no seeded user is an admin yet), or remove the page?
  2. BUG-005: OK to remove the key from the browser code (recommended)? If it was ever a real key, rotate it in Stripe.
  3. BUG-015: send the Terms text (recommended), approve a placeholder, or drop the link?
  4. CART-009: a quantity above stock is accepted (10 spoons, 3 in stock). Cap it at stock (recommended), refuse it, or allow back-orders?
  5. BUG-016 (S4): should the search box keep your query after searching? (recommended: yes)
  6. Is the new wording from the fixes OK? "An account with this email already exists", "Enter a valid email address",
     "Please enter a Ship to address", "Your cart is empty. Continue shopping", and "0 reviews" on product pages
Your checks: PAGE-004, about 3 min of looking at desktop and phone width → qa/STATUS.md
Details: qa/STATUS.md · qa/runs/001-setup.md · ≈ $6.60 API-equivalent (estimate was ~$6)
```

- **What was fixed:** 17 bugs, each checked afterwards by a separate verifier that hadn't found it:
  - one customer could read another's orders through the orders API;
  - search text and the sign-in `next` value were injected into the page as HTML, and `next` could send users to another site;
  - a wrong password showed a 500 page;
  - duplicate and invalid emails were accepted at sign-up;
  - signing out didn't end the session;
  - saved addresses weren't kept;
  - negative or NaN quantities were accepted, and the empty cart showed "undefined";
  - out-of-stock or unknown products could be added;
  - product pages threw a script error;
  - the cart scrolled sideways on phones, and an order could be placed with no Ship to;
  - names and Ship to addresses rendered as HTML (found while checking the first fixes).
- **Not tested:** only Chrome was available on this machine, so Firefox, Safari and real phones aren't covered. Password-reset email delivery isn't covered either.
- **Uncommitted files:** your existing changes under `.claude/skills/` were left as they were. The new `.gitignore` and `qa/` folder are also uncommitted.
- **Process:** I did the scout's mapping and wrote the checklist myself because the app is one small file. Testers and verifiers were all separate agents that didn't read the source.

**How to read it:** start 
```
