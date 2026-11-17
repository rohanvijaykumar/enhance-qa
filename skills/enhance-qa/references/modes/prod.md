# Mode: prod (read-only smoke after a deploy)

**When:** the user says "prod", "after deploy" or "check production", or gives a production URL. Also suggested after a release on live products.

## Rules (stricter than other modes)

- **Read-only.** Load pages, call read-only endpoints, read public files. Don't submit forms, create accounts, buy anything, send messages, or change any data.
- **Logging in only as a named test account** the user explicitly allowed for production (`prod_test_account:` in the plan), and only for read-only checks.
- **Only checks tagged `prod-safe` run,** plus the smoke checks that are read-only. If a smoke check writes data, it's skipped and listed.
- **Gentle.** No load, no rapid repeats, no scanning beyond the product's own pages. Respect rate limits and robots rules for crawling.

## Scope

1. **The `prod-safe` and read-only smoke checks:**
   - the home or main page;
   - key pages and routes;
   - static assets;
   - the API health or read endpoints.
2. **Deployment sanity:**
   - the version or build ID shown matches the release;
   - no debug banners or dev-only tools;
   - production config (no localhost URLs, test keys or staging hosts in pages or bundles);
   - HTTPS and redirects;
   - security headers present.
3. **The read-only parts of `gates/web-launch.md`** where the product is a web product: secrets in bundles, headers, legal pages, SEO and sharing, an accessibility and performance smoke.
4. **Console and network errors** on the main pages.

## Process

1. Intake: can the production URL be reached at all?
2. Testers, at the fast tier, run the scope.
3. A verifier confirms failures, read-only too.
4. Report, with the verdict "Production looks healthy" or "Problems in production: …".

Severity is raised one level for anything visible to all users. Fixing goes through the normal flow, on the code, never in production.
