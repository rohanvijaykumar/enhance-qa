# App notes · Corner Shop

## How to start
- No install step (no dependencies). Start: `npm start` (or `node server.js`) → http://localhost:4310, ready when the log says "Corner Shop ready on".
- The lead starts the server once per run; don't restart it unless a check needs fresh data.
- Reset data: restart the server (all data is in memory).
- Server log during runs: `qa/.state/server.log`.

## How to log in
- Test user A: env QA_USER_A_EMAIL / QA_USER_A_PASSWORD · Test user B: QA_USER_B_EMAIL / QA_USER_B_PASSWORD (load with `set -a; . qa/.state/accounts.env; set +a`).
- Sign in at /login: fields labelled "Email" and "Password", button "Sign in". Session cookie `sid` (HttpOnly).
- curl: `curl -s -c jar -b jar -d "email=$QA_USER_A_EMAIL&password=$QA_USER_A_PASSWORD" http://localhost:4310/login`
- Create extra throwaway users only with `@example.test` emails.

## Drivers that work here
- Web: `node .claude/skills/enhance-qa/scripts/drive-web.mjs plan.json` (Playwright 1.65.1, runs installed Chrome). One plan per check.
- Plain HTTP: curl (Git Bash) for status codes, redirects, headers and JSON.
- Not available: Firefox, WebKit, real devices.
- Driver: set `"base": "http://localhost:4310"` in every plan (its default is :3000). `expectUrl` takes a path or a /regex/ literal. `readAll` on `li.product` returned []; use `eval` or `expectText`. No `header` locator; use body text.
- Working locators: {"label":"Email"}, {"label":"Password"}, {"role":"button","name":"Sign in"}, {"role":"link","name":"Ceramic mug"}, {"label":"Ship to"}. "Sign out" is a button, not a link.
- Git Bash curl: use `MSYS_NO_PATHCONV=1` when a value starts with "/"; avoid `-w` strings starting with "/"; log in with `--data-urlencode email=… --data-urlencode password=…`.
- drive-web result JSON lists `pageErrors` and `console` only when there are some; absent means no script errors.
- Keep curl cookie jars inside qa/evidence/<run>/, never in the project root.
- Cart rows: compare each row's amount as well as the total (curl-only totals checks missed BUG-022). Input values (e.g. Ship to) aren't in body text; read the field value.
- Forms: POST /signup (name, email, password) → /account · POST /account/address (address) · POST /cart/add (productId) · /cart/update (productId, qty) · /cart/remove (productId) · POST /checkout (shipTo).

## App map
| Area | Where | How to reach | Key elements |
|---|---|---|---|
| shop | /, /?q=, /product/<id> | header "Shop" | label "Search", button "Search", product links `li.product a`, button "Add to cart", `#reviews` |
| auth | /login, /signup, /reset, POST /logout | header "Sign in", "Sign up"; "Forgot password?" | labels Email, Password, Name; buttons "Sign in", "Create account", "Send reset link", "Sign out" |
| cart | /cart | header "Cart (n)" (`#cart-count`) | quantity input "Quantity for <product>", buttons "Update", "Remove", link "Checkout", `.total` |
| checkout | /checkout | cart "Checkout" link | label "Ship to", button "Place order (test mode)" |
| orders | /orders, /orders/<id>, /api/orders/<id> | header "Orders" | links "Order #<id>" |
| account | /account | header "Account" | label "Shipping address", button "Save address", status "Address saved" |
| content | /pricing, /terms, /privacy | footer links | |

## Waits and timing
- Pages are server-rendered; no waits needed.

## Quirks
- Seed data: user A owns order #101, user B owns order #102.
- Cart total reads "Total: $12.00" (with a colon). Tab order on /login: Shop, Sign in, Sign up, Email, Password, Sign in button, Forgot password?, footer.
- Testers leave throwaway users and orders on the shared server; restart it for clean data between phases.

## Don't report
