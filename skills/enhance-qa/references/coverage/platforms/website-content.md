---
module: website-content
kind: platform
title: Website and content site
checked: 2026-11-16
---
# Website and content site

Covers marketing sites, landing pages, blogs, documentation sites and storefront pages: what visitors and search engines see. It covers links, SEO, social previews, legal pages, images, redirects, 404s and page performance. It doesn't cover application logic behind a login (use `web-app.md`) or checkout internals (use `../features/payments-subscriptions.md`). It goes with `web-app.md` for anything interactive, `../features/performance.md`, `../features/accessibility.md`, `../features/privacy-consent.md` and `../gates/web-launch.md`.

## Signals

- A static-site generator or CMS: `astro`, `next` with mostly static pages, `gatsby`, `hugo`, `jekyll`, `eleventy`, `docusaurus`, `mkdocs`, `vitepress`, WordPress, Webflow export, Shopify theme.
- Folders of Markdown or MDX (`content/`, `posts/`, `docs/`), `sitemap.xml`, `robots.txt`, `_redirects`, `netlify.toml`, `vercel.json` with redirects.
- README words: "landing page", "blog", "docs", "marketing", "portfolio", "store".

## Kickoff questions

1. What is the live or staging URL, and is it already indexed by search engines? (best guess: local build now, staging URL later; not yet indexed)
2. Which pages matter most (home, pricing, one blog post, docs home)? (best guess: the top five by the nav)
3. Does it sell anything, collect emails, or set analytics cookies? (best guess: analytics plus an email form)

## Drivers

1. **`curl -I` and `curl -sL` with scripts.** The cheapest reliable driver for status codes, redirect chains, headers, canonical tags, titles and meta. A short script can crawl the sitemap and check every URL.
2. **A link crawler** such as `lychee`, `linkinator` or `broken-link-checker`. Run on the built output or the staging URL, with a polite rate (one or two requests at a time, no hammering third-party sites; skip external links or rate-limit them).
3. **Playwright CLI.** For rendered checks: JavaScript-dependent content, images that lazy-load, cookie banners, layout at different widths. Observe with scoped accessibility snapshots; screenshots at 1280×800 or smaller for visual checks.
4. **`lighthouse` CLI or Chrome DevTools MCP.** Lab performance, SEO and accessibility audits, plus Core Web Vitals traces [1]. Lab numbers are a guide; field numbers need real-user data.
5. **Validators.** Google's Rich Results Test and the Schema.org validator for structured data [2], the W3C HTML validator, and an Open Graph and Twitter-card preview tool. Where the validator is a web page needing a public URL, mark the check as needing the staging site.
6. **`html-validate`, `markdownlint`, `cspell`** on source files for markup and spelling.

**Can't be driven here:** how search engines actually index and rank the site (Search Console, takes days to weeks); how a link looks when shared in a real app (Slack, WhatsApp, LinkedIn, X cache previews and need a public URL); and legal wording (human). Real-user Core Web Vitals need field data.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | home page, Chromium, desktop, status 200 and no console errors |
| check | smoke, plus the changed pages at 390 and 1280 px wide, plus link crawl of changed pages |
| full | all sitemap URLs × (mobile, desktop) × (Chromium, WebKit) with link, SEO and performance checks |
| release | full, plus Firefox, slow network, human review of copy, legal pages and share previews |

Dimensions: page type (home, listing, article, docs, product, legal, 404); viewport; engine; network speed; locale and language version; signed-out only (mostly).

## Check catalogue

### Smoke
- [high · agent] Load the home page and the top five pages → HTTP 200, content visible, no console errors, no failed requests {smoke}
- [high · auto] Build the site and serve the output → build exits 0 with no broken-link or missing-asset warnings {smoke}
- [high · auto] Crawl every internal link on the built site → no 404, no 5xx, no redirect loops {smoke}

### Links and navigation
- [high · auto] Check every internal link, anchor (`#section`) and image path → each resolves; anchors land on an element that exists
- [medium · auto] Check external links with polite rate limits → none return 404 or 410; those that block bots (403, 999) are listed as "needs a human look", not as failures
- [medium · agent] Click every item in the header, footer and mobile menu → each goes to the right page; the current page is marked
- [medium · agent] Open and close the mobile menu, and use it by keyboard → opens, closes, traps focus while open, Esc closes it {a11y}
- [medium · agent] Check `mailto:` and `tel:` links → correct address and number, no placeholder values
- [low · agent] Click every call-to-action button on the home page → each goes to the page its label promises
- [medium · agent] Search on a docs or blog site with a known term, a typo and a term with no results → relevant hits, a useful no-results message

### SEO basics
- [high · auto] For each page read `<title>` → present, unique across the site, describes the page, no "Untitled", site-name placeholder or template text [3]
- [high · auto] For each page read `<meta name="description">` → present, unique, written for people, not the same on every page
- [high · auto] Check `<link rel="canonical">` → present on indexable pages, absolute URL, points to the page itself (or the right preferred version), never to a staging domain [4]
- [high · auto] Check for `noindex` in the meta robots tag and `X-Robots-Tag` header on production pages → absent on pages that should be indexed; present on staging, thank-you and admin pages {smoke}
- [high · auto] Fetch `/robots.txt` on production → it exists, doesn't `Disallow: /` by accident, and references the sitemap [5]
- [high · auto] Fetch `/sitemap.xml` → valid XML, lists only canonical 200 URLs, no redirects, no `noindex` pages, correct production domain [6]
- [medium · auto] Check each page has one `<h1>` and a sensible heading order → one h1, no skipped levels {a11y}
- [medium · auto] Check `<html lang>` and `hreflang` pairs on multi-language sites → correct language codes; each hreflang page links back
- [medium · auto] Check URLs → lowercase, readable, no session ids or parameters needed for content, consistent trailing-slash rule
- [medium · auto] Run Lighthouse SEO audit on the top pages → no failed audits, or each failure is explained
- [low · agent] Pages with thin or duplicated content, paginated archives and tag pages → they don't create near-duplicate indexable pages without canonical or noindex

### Structured data
- [medium · auto] Validate JSON-LD (Article, Product, Organization, BreadcrumbList, FAQ, SoftwareApplication as used) → valid syntax, required properties present, values match the visible page [2]
- [medium · agent] Compare structured-data price, availability, rating and dates with the page → they match; no ratings or reviews that aren't shown on the page
- [low · auto] Breadcrumb markup matches the visible breadcrumb trail → same names and URLs

### Social previews
- [high · auto] Check `og:title`, `og:description`, `og:image`, `og:url`, `og:type` on key pages → present; the image URL is absolute, public and returns 200 [7]
- [medium · auto] Check `twitter:card` (and `twitter:image` if different) → a supported card type is set, and it falls back to Open Graph tags where allowed [8]
- [medium · auto] Check the share image's size and type → a sensible ratio (about 1.91:1 is common), small enough to load fast, readable text, no placeholder art
- [low · human] Paste the staging URL into a link-preview debugger or a chat tool → title, description and image look right (preview caches may need a refresh)

### Legal and trust pages
- [high · agent] Find the privacy policy, terms, cookie policy (if cookies are used), contact page and company details from the footer on every page → each link exists and opens real text, not "lorem ipsum" or a 404
- [high · agent] Compare what the privacy policy says with what the site actually does (analytics, forms, embedded media, cookies) → they agree; trackers don't fire before consent where consent is required {security}
- [medium · agent] Cookie banner: reject all, accept all, change choice later → rejection stops non-essential cookies and scripts; the choice persists and can be changed
- [medium · agent] Copyright year, company name, address, pricing and "last updated" dates → current and consistent across pages
- [medium · human] Read the legal pages → they match the real business and jurisdiction; a lawyer reviews them if needed

### Images and media
- [high · auto] Every `<img>` has `alt` (empty `alt=""` for decoration) and width and height or an aspect ratio → no missing alt on content images; no layout shift when loading {a11y}
- [medium · auto] Compare image file size with display size → no multi-megabyte photos in cards; modern formats (WebP, AVIF) or responsive `srcset` where claimed
- [medium · agent] Throttle the network and load a long page → images lazy-load below the fold, the hero image loads first, text isn't blocked
- [medium · agent] Video and embeds (YouTube, maps) → load on demand, have captions or a transcript if they carry key content, don't autoplay with sound
- [low · auto] Favicon, `apple-touch-icon` and web manifest icons → exist at the declared sizes and look right on light and dark tabs

### 404s, redirects and errors
- [high · auto] Request a non-existent URL → HTTP 404 status (not 200 "soft 404") with a branded page that links home and search [9]
- [high · auto] Follow every redirect in the redirect map (old URLs, `http` to `https`, `www` to apex, trailing slash) → a single 301 hop to the final 200, no chains over two hops, no loops [10]
- [medium · auto] Request `http://`, `www.` and non-`www` variants → all end up on one canonical HTTPS URL
- [medium · auto] Check the HTTPS certificate and mixed content → valid and not near expiry; no `http://` assets on HTTPS pages
- [medium · agent] Trigger a server error page (if one can be forced on staging) → a human message, no stack trace

### Performance and Core Web Vitals
- [high · auto] Run Lighthouse on home, a listing and an article page, mobile profile → report LCP, CLS and TBT (a proxy for INP); note anything past LCP 2.5 s or CLS 0.1 [1]
- [medium · auto] Check total page weight, number of requests and render-blocking CSS and JS → no unexplained megabytes; big third-party scripts are named
- [medium · agent] Fonts: reload with slow network → text is visible during font load (`font-display`), little layout jump
- [medium · agent] Check cookie banners, chat widgets and ads on mobile → they don't cover the content or cause large layout shifts
- [low · auto] Check caching headers on static assets and compression (gzip or brotli) → hashed assets are cached long-term, text is compressed

### Content and accessibility
- [high · agent] Read every top page → no lorem ipsum, "TODO", broken template tags, "undefined", wrong brand or product names, outdated prices
- [medium · agent] Check dates on blog posts and docs, version numbers, screenshots and code samples → current and consistent with the product
- [medium · auto] Run `cspell` or an equivalent on content files → no typos in headings and CTAs; brand terms are whitelisted
- [medium · auto] Run axe on top pages → no serious or critical violations {a11y}
- [medium · agent] Check link text and button labels → no bare "click here"; each link says where it goes {a11y}
- [medium · agent] Code samples in docs: copy and run two or three → they work on a clean machine as written

### Forms on content sites (newsletter, contact)
- [high · agent] Submit the newsletter and contact forms with a test address → success message; the entry arrives in the test inbox or the form tool (never a real person's address)
- [medium · agent] Submit an invalid email, empty fields and a very long message; try a spam-like input → clear errors; spam protection works without blocking normal use
- [medium · agent] Check the consent checkbox and wording where emails are collected → not pre-ticked where consent is required; the link to the privacy policy works

## Gates

- `../gates/web-launch.md` for the 14-check web launch gate against the deployed URL.
- `../gates/privacy-law.md` and `../gates/accessibility-law.md` for sites serving the EU, UK, US or children.
- Production blockers specific to content sites: no `noindex` or `Disallow: /` left from staging, canonical and sitemap use the production domain, legal pages exist, no placeholder content, HTTPS valid.

## Human-only checks

- [human] Read the home page, pricing and one article → tone, claims and prices are right and say what the business intends
- [human] Share a staging link in a private chat → the preview card shows the right title, description and image
- [human] Look at the site on a real phone → type is readable, buttons are tappable, menus work
- [human] Review legal pages and consent wording with the business owner or a lawyer → they're accurate for the real business and region
- [human] After launch, add the site to Search Console and check the index report after a few days → pages are indexed; no unexpected exclusions

## Known pitfalls

- **Staging settings left on.** A `noindex`, `Disallow: /` or password protection is correct on staging and a launch blocker on production. Check which environment you are testing before filing.
- **Bots get blocked.** Social sites and some CDNs return 403, 429 or 999 to crawlers. List these as "unverified", not broken.
- **Preview caches.** Social platforms cache link previews; an old image may be the cache, not the site.
- **Lighthouse is a lab run.** Scores vary between runs by several points; compare against the same settings, retry once, and don't file a 2-point change.
- **Canonical vs redirect.** A page with a canonical pointing elsewhere isn't a bug if that is intended (for example syndicated or paginated content).
- **Lazy-loaded images** can look "missing" in a screenshot taken before scrolling; scroll first.
- **Third-party widgets** (chat, maps, ads) cause console errors and layout shifts outside your control; note them, don't file them as site bugs unless they break the page.
- **Don't hammer other people's sites.** Rate-limit external link checks; skip checks that need a login.
- **Time-based content** (sales banners, "posted 3 days ago", copyright year) changes under test; check the logic, not a single value.

## Sources

1. [web.dev: Web Vitals](https://web.dev/articles/vitals) — thresholds; Lighthouse uses TBT as a lab proxy for INP (checked 2026-11-16)
2. [Google: Intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) — markup and the Rich Results Test (checked 2026-11-16)
3. [Google: Search essentials, technical requirements](https://developers.google.com/search/docs/essentials/technical) — crawlable, 200 status, indexable content (checked 2026-11-16)
4. [Google: Consolidate duplicate URLs (canonical)](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) — canonical tags (checked 2026-11-16)
5. [Google: Introduction to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro) — robots.txt rules (checked 2026-11-16)
6. [Google: Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) — what a sitemap should contain (checked 2026-11-16)
7. [The Open Graph protocol](https://ogp.me/) — required og properties (checked 2026-11-16)
8. [X developer docs: Cards overview](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards) — card types and Open Graph fallback (checked 2026-11-16)
9. [Google: HTTP status codes and soft 404s](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) — status handling in search (checked 2026-11-16)
10. [Google: Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects) — permanent redirects (checked 2026-11-16)
11. [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/) — alt text, link purpose, heading structure (checked 2026-11-16)
