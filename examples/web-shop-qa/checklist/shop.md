# Shop
- Area: SHOP
- Paths: server.js, static/**
- Modules: web-app, search-filter-sort
- Notes: Three seeded products; the Linen tea towel is out of stock.

### SHOP-001 · The shop home page lists the products
- Risk: high · Type: agent · Tags: smoke, prod-safe
- Steps: Open / as a guest
- Expect: HTTP 200, heading "Shop", three products listed with prices (Ceramic mug $12.00, Linen tea towel $9.50, Walnut spoon $18.00); no script errors
- Source: README (Features: browse)

### SHOP-002 · Out-of-stock items are marked
- Risk: medium · Type: agent · Tags: prod-safe
- Steps: Open / → look at the Linen tea towel row → open its product page
- Expect: The row says "Out of stock"; the product page shows "Out of stock" and no "Add to cart" button
- Source: README (Features: out-of-stock items are marked)

### SHOP-003 · Search finds matching products
- Risk: high · Type: agent · Tags: smoke, prod-safe
- Steps: Open / → type "mug" in Search → click "Search"
- Expect: Only "Ceramic mug" is listed, with a "Results for mug" line
- Source: README (Features: search)

### SHOP-004 · Search is case-insensitive
- Risk: low · Type: agent
- Steps: Search for "WALNUT"
- Expect: "Walnut spoon" is listed
- Source: base: conventional search behaviour
- Assumed: yes

### SHOP-005 · A search with no matches says so
- Risk: medium · Type: agent
- Steps: Search for "zzzz"
- Expect: "No products match your search." and no products listed
- Source: base: empty state

### SHOP-006 · The search box keeps the query after searching
- Risk: low · Type: agent
- Steps: Search for "mug" → look at the Search box on the results page
- Expect: The Search box still contains "mug"
- Source: base: conventional search behaviour
- Assumed: yes

### SHOP-007 · A product page shows name, price and Add to cart
- Risk: high · Type: agent · Tags: smoke, prod-safe
- Steps: Open / → click "Ceramic mug"
- Expect: Heading "Ceramic mug", price "$12.00", an "Add to cart" button; no script errors in the console
- Source: README (Features: browse)

### SHOP-008 · An unknown product shows a not-found page
- Risk: low · Type: agent · Tags: prod-safe
- Steps: Open /product/999
- Expect: HTTP 404 with "Product not found" and the normal header and footer
- Source: base: error handling

### SHOP-009 · The product list API returns the catalogue
- Risk: low · Type: auto · Tags: prod-safe
- Command: `curl -s -w '\n%{http_code}' http://localhost:4310/api/products` → status 200 and a JSON array of 3 products with id, name, price
- Expect: 200 and a JSON array of the three products
- Source: base: API contract

### SHOP-010 · An unknown page shows a friendly 404
- Risk: low · Type: agent · Tags: prod-safe
- Steps: Open /no-such-page
- Expect: HTTP 404, "Page not found" and a "Back to the shop" link that goes to /
- Source: base: error handling

### SHOP-011 · Charter: browse and search tour
- Risk: medium · Type: agent · Tags: exploratory
- Steps: 15 minutes. Explore browsing, search (odd characters, spaces, long text, empty) and product pages, as a guest and signed in. Watch the console.
- Expect: No S1–S3 problems; notes say what was covered
- Source: base: exploratory

### SHOP-012 · Search HTML is shown as text
- Risk: high · Type: agent · Tags: regression
- Steps: Open /?q=<b>bold</b><img src=x onerror=alert(1)> (URL-encoded)
- Expect: The query appears literally; no <b> or <img> element is created; no script runs
- Source: BUG-003

### SHOP-013 · Product pages load without script errors
- Risk: high · Type: agent · Tags: regression
- Steps: As a guest open /product/1 and /product/3
- Expect: No page errors; the reviews box doesn't stay on "Loading reviews…"
- Source: BUG-014
