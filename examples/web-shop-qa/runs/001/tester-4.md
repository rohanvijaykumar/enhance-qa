# Run 001 · tester 4 · area: shop, content, a11y

## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| SHOP-002 | pass | Home row "Linen tea towel $9.50 Out of stock"; product page shows "Out of stock", no "Add to cart" | evidence/001/shop-002-home.html, plans/shop-002b.json | |
| SHOP-005 | pass | "No products match your search." and no product links for "zzzz" | evidence/001/plans/shop-005.json | |
| SHOP-008 | pass | HTTP 404, "Product not found", header and footer present | evidence/001/shop-008.html | |
| SHOP-009 | pass (auto) | `curl /api/products` → 200, 3 items with id, name, price, stock | evidence/001/shop-009.txt | |
| SHOP-010 | flaky 2/3 | Run 1 failed on my own bad expectUrl; runs 2 and 3 passed: "Back to the shop" → / | evidence/001/shop-010-r1*, plans/shop-010-r1.json | |
| SHOP-004 | pass | "WALNUT" lists "Walnut spoon" | evidence/001/plans/shop-004.json | |
| SHOP-006 | fail 2/2 | After searching "mug" the Search box is empty; `value=""` in server HTML | evidence/001/shop-006-search.html, shop-006-r1 run | C2 |
| PAGE-001 | fail 2/2 | Footer "Terms" → HTTP 404, title "Not found · Corner Shop", "Page not found" | evidence/001/page-001-fail.png, page-_terms.html | C1 |
| PAGE-002 | fail 1/1 | /pricing reads "Recieve your order"; /terms is 404, so it could not be read | evidence/001/page-_pricing.html, page-_terms.html | C5 |
| PAGE-003 | pass | Titles: "Shop · Corner Shop", "Ceramic mug · Corner Shop", "Sign in · Corner Shop", "Pricing · Corner Shop", "Privacy · Corner Shop" | evidence/001/page-_*.html | |
| PAGE-004 | not-run | Human check; not run per lead's instruction | | |
| A11Y-001 | pass | Every visible input named: login email/password; signup Name/Email/Password; reset Email; cart "Quantity for Ceramic mug"; checkout "Ship to"; account "Shipping address" | evidence/001/plans/a11y-001.json | |
| A11Y-002 | pass | Clean run r3: Tab x4 reaches Email, Tab to Password, Tab to Sign in (outline auto, visible); Enter signs in (user A, URL leaves /login) | evidence/001/plans/a11y-002-r3.json | |
| A11Y-003 | pass (auto) | `<html lang="en"` | evidence/001 (curl output) | |
| A11Y-004 | fail 2/2 | At 390x844, /cart with one item: scrollWidth 620 > viewport 390 (horizontal scroll). Home, product, login, checkout are 390 wide, no overflow | evidence/001/a11y-004-a11y-004-cart.png, a11y-004-r1-a11y-004-cart-r1.png | C6 |
| SHOP-011 | done (charter) | See Charter notes | evidence/001/shop-011-odd.html, plans/shop-011.json | C3, C4, C7 |

## Candidates
### C1 · Terms page is missing (footer link returns 404)
- Check: PAGE-001 · Severity guess: S2 · Seen: 2/2 (plus curl 404)
- Steps: Open / → click "Terms" in the footer
- Expected: 200 with a "Terms" heading (source: README, Features: Pricing, Terms and Privacy pages in the footer)
- Actual: URL /terms, HTTP 404, title "Not found · Corner Shop", text "Page not found"
- Evidence: qa/evidence/001/page-001-fail.png, qa/evidence/001/page-_terms.html

### C2 · Search box empties after searching
- Check: SHOP-006 · Severity guess: S3 · Seen: 2/2
- Steps: Open / → type "mug" in Search → click "Search"
- Expected: Search box still contains "mug" (source: base: conventional search behaviour)
- Actual: results page /?q=mug shows "Results for mug" but the input value is empty
- Evidence: qa/evidence/001/shop-006-search.html

### C3 · Search query is echoed as unescaped HTML (reflected HTML injection)
- Check: SHOP-011 (charter) · Severity guess: S2 · Seen: 2/2
- Steps: Open /?q=<b>mug</b> (or the URL-encoded form)
- Expected: The query is shown as plain text, "Results for <b>mug</b>" (source: base: conventional output escaping)
- Actual: Markup is rendered: "Results for <b><b>mug</b></b>"; the bold is applied to the page. Browser text shows "mug&\"'%" with the tags removed for the odd-character query. Only <b> was tested; no other payloads were tried.
- Evidence: qa/evidence/001/shop-011-odd.html, qa/evidence/001/shop-011-fail.png

### C4 · Search with a trailing space finds nothing
- Check: SHOP-011 (charter) · Severity guess: S3 · Seen: 2/2
- Steps: Open /?q=mug%20 (search "mug ")
- Expected: "Ceramic mug" is listed (a leading space works: /?q=%20mug lists it)
- Actual: "No products match your search." (query is not trimmed)
- Evidence: qa/evidence/001/shop-011-fail.png

### C5 · Typo "Recieve" on the Pricing page
- Check: PAGE-002 · Severity guess: S4 · Seen: 1/1
- Steps: Read /pricing
- Expected: No misspelled words (source: base: copy quality)
- Actual: "Shipping is free on orders over $50. Recieve your order in 3–5 working days."
- Evidence: qa/evidence/001/page-_pricing.html

### C6 · Cart page scrolls sideways on a phone
- Check: A11Y-004 · Severity guess: S3 · Seen: 2/2
- Steps: At 390x844 sign up a new user → open /product/1 → "Add to cart" → open /cart
- Expected: No horizontal scrolling (source: web-app: responsive)
- Actual: document scrollWidth 620 on a 390 px viewport
- Evidence: qa/evidence/001/a11y-004-a11y-004-cart.png

### C7 · Outside checks: "reviewCache is not defined" on product pages
- Check: outside checks · Severity guess: S3 · Seen: every product page load (N/N)
- Steps: Open /product/1 (also /product/2)
- Expected: No script errors in the console (SHOP-007 expects none)
- Actual: pageErrors: "reviewCache is not defined"
- Evidence: qa/evidence/001/shop-002-p2 (driver output), a11y-004 driver output

## Charter notes
SHOP-011 (about 10 min, guest): tried search with a blank space, "<b>mug</b>&\"'%", a 300-character query, "mug " with a trailing space, " mug", a non-ASCII check mark, product pages /product/3, /product/1/ and /product/abc, and duplicate q params. Signed in as a throwaway user: cart and checkout pages at phone width. Findings are C3, C4 and C7. Not covered: reviews section and order flows.

## Learned
- Driver `readAll` on "li.product" returned [] on the home page. Use `eval` or `expectText` instead.
- The Sign out control is a button, not a link. `waitFor` on it needs role "button".
- expectUrl takes a plain path or a /regex/ literal; a bare "/$" does not work.
- Login: Tab order from /login is Shop, Sign in, Sign up, Email, Password, Sign in button, Forgot password?, Pricing. The footer is after the form.
- Throwaway users created this run: qa-t4-*@example.test (signup, cart with Ceramic mug, checkout), qa-t4b-*@example.test (created, not used), qa-t4c-*@example.test (signed up, cart with Ceramic mug). Password was the throwaway one, not a real credential.
- Product pages return HTTP 404 for unknown ids (/product/999); /product/abc also returns "Product not found".
- Search results and the reviews section were not checked by this tester.
