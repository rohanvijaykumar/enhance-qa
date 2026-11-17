# Run 002 · tester 4 · area: shop, content, a11y, security (build 5, chrome-desktop)
## Results
| Check | Result | Note | Evidence | Bug |
|---|---|---|---|---|
| SEC-001 | pass | User A GET /admin: 404 "Page not found", no emails (guest gets 302) | evidence/002/t4-sec001.txt | |
| SEC-010 | pass | Name, account page and order #107 "Ship to" all literal text; 0 b/i/img elements | evidence/002/t4-sec010.txt, t4-sec010b.txt | |
| SHOP-012 | pass | Raw HTML shows &lt;b&gt;...escaped; no injected img | evidence/002/t4-shop012.html | |
| SHOP-013 | pass | /product/1 and /3: no pageErrors/console; reviews show "0 reviews" | evidence/002/t4-guest.txt | |
| PAGE-005 | pass | "Shipping is free on orders over $50. Receive your order in 3–5 working days." | evidence/002/t4-guest.txt | |
| A11Y-005 | pass | 390x844 scrollWidth 390 with 1 and 2 items; at 1280 one table | evidence/002/t4-phone.txt, t4-phone-t4-phone-cart2.png | |
| SHOP-002 | pass | Row "Linen tea towel · $9.50 Out of stock"; /product/2 "Out of stock", 0 buttons | evidence/002/t4-guest.txt | |
| SHOP-005 | pass | /?q=zzzz: "No products match your search.", 0 li.product | evidence/002/t4-guest.txt | |
| PAGE-001 | fail | Footer Terms link: /terms 404 "Page not found" (Pricing, Privacy 200). Retry via curl: 404 again (2/2) | evidence/002/t4-guest.txt | |
| A11Y-001 | pass | All visible inputs named (login, signup, reset, cart Quantity for X, checkout Ship to, account Shipping address) | evidence/002/t4-phone.txt | |
| A11Y-002 | pass | Tab order Shop, Sign in, Sign up, Email, Password, Sign in button; default focus outline (auto 1px); Enter signed in | evidence/002/t4-kbd.txt, t4-kbd2.txt | |
| A11Y-004 | pass | 390 wide: /, product, login, cart (2 items), checkout, account all scrollWidth 390; 0 buttons/links past right edge | evidence/002/t4-phone.txt | |
| SHOP-011 | pass-with-candidates | see charter notes | evidence/002/t4-charter.txt, t4-charter2.txt | |
## Candidates
### C1 · Terms page is missing: footer "Terms" link goes to "Page not found"
- Check: PAGE-001 · Severity guess: S2 · Seen: 2/2
- Steps: Open / as guest → click "Terms" in footer (or GET /terms)
- Expected: 200 with heading "Terms" (source: README Features: Pricing, Terms and Privacy pages in the footer)
- Actual: HTTP 404, title "Not found · Corner Shop", heading "Page not found"
- Evidence: evidence/002/t4-guest.txt (f2, httpErrors)
### C2 · A very long search word makes the page scroll sideways on a phone
- Check: SHOP-011 (outside checks) · Severity guess: S4 · Seen: 1/1
- Steps: At 390x844 open /?q= followed by 600 "a" characters
- Expected: no horizontal scrolling (source: A11Y-004 web-app: responsive)
- Actual: scrollWidth 5186 (the "Results for ..." line doesn't wrap)
- Evidence: evidence/002/t4-charter.txt (long), t4-charter-*.png
### C3 · Search ignores a query with leading/trailing spaces
- Check: SHOP-011 (outside checks) · Severity guess: S4 · Seen: 1/1
- Steps: Open /?q=%20mug%20 (type " mug " in Search)
- Expected: Ceramic mug listed (conventional search trims spaces; source: base)
- Actual: "Results for mug" and "No products match your search."
- Evidence: evidence/002/t4-charter.txt (paddedmug)
### C4 · Search box is emptied after searching (SHOP-006 behaviour, seen on every results page)
- Check: SHOP-006 (outside my checks) · Severity guess: S4 · Seen: 4/4
- Steps: Search "spoon" (by button or Enter) → look at Search box
- Expected: box still contains the query (source: SHOP-006, assumed)
- Actual: input value is empty (HTML `<input name="q" value="">` on /?q=mug)
- Evidence: evidence/002/t4-charter2.txt (enter), t4-shop012.html
## Charter notes
SHOP-011 at 390x844 (plus a few at desktop via curl): empty, spaces-only, padded, partial ("m u"), quotes/backslash/semicolon, %, regex chars, unicode/emoji, 600-char, duplicate q params, uppercase, unknown word; product ids 0, abc, 1.5, -1 (all 404 "Product not found" with header/footer); product pages 1 and 3, guest Add to cart (redirects to /login?next=/cart), signed in add (lands on /cart, badge 1, persists after search), back button from product, Enter in Search. No page errors or console output seen. Only C2, C3, C4 found. Cart left empty for throwaway r2t4-sec010b.
## Learned
- Driver eval: avoid "\n" and regex `\s` in heredoc JSON (broke); use innerText directly.
- Footer Terms link 404 so other testers' "Terms" steps will fail.
- Throwaway user r2t4-sec010b@example.test (cart empty, order #107) usable for cart tests so user A's cart isn't shared.
- Guest "Add to cart" redirects to /login?next=/cart; signed-in lands on /cart.
