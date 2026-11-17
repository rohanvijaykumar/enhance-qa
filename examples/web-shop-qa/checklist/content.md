# Content pages
- Area: PAGE
- Paths: server.js, static/style.css
- Modules: website-content

### PAGE-001 · Every footer link opens its page
- Risk: medium · Type: agent · Tags: prod-safe
- Steps: Open / → follow "Pricing", "Terms" and "Privacy" in the footer
- Expect: Each returns 200 with a heading naming the page (Pricing, Terms, Privacy); no "Page not found"
- Source: README (Features: Pricing, Terms and Privacy pages in the footer)

### PAGE-002 · Content pages have no spelling mistakes
- Risk: low · Type: agent · Tags: prod-safe
- Steps: Read the text of /pricing, /terms and /privacy
- Expect: No misspelled words
- Source: base: copy quality

### PAGE-003 · Every page has a useful title
- Risk: low · Type: agent · Tags: prod-safe
- Steps: Open /, a product, /login, /pricing, /privacy
- Expect: Each tab title names the page and ends "· Corner Shop"
- Source: web-app: page titles

### PAGE-004 · The shop looks right and reads well
- Risk: low · Type: human · Tags: visual
- Steps: Open http://localhost:4310 on your computer and at phone width (or on your phone on the same network) → browse a product, the cart and checkout
- Expect: It looks tidy and trustworthy enough to launch; nothing overlaps or is cut off; wording sounds right
- Source: human judgement

### PAGE-005 · Pricing page spelling
- Risk: high · Type: agent · Tags: regression
- Steps: Open /pricing
- Expect: Reads "Receive your order in 3–5 working days."
- Source: BUG-017
