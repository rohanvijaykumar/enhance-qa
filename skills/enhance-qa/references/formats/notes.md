# App notes format

`qa/notes.md` is the testers' handbook. Every tester reads the parts it needs first, instead of rediscovering how to start the app, log in or find a screen. That saves the most money of any single file.

The scout writes it during setup. The lead merges what testers learn (their "Learned" sections) after each run. Keep it short and factual: commands, paths, labels and waits, not prose.

```markdown
# App notes · Recipe Share

## How to start
- Install: `npm ci` · Seed: `npm run seed:qa` (creates test users A and B)
- Start: `npm run dev` → http://localhost:3000 (ready when the log says "Ready in")
- Reset data: `npm run db:reset && npm run seed:qa`
- Stop: Ctrl+C. Port in use → `npx kill-port 3000`

## How to log in
- Test user A: env QA_USER_A_EMAIL / QA_USER_A_PASSWORD · Test user B: QA_USER_B_EMAIL / QA_USER_B_PASSWORD
- Saved session: qa/.state/sessions/user-a.json (Playwright storage state)
- Admin: none in seed data → admin checks are blocked until the user adds one

## Drivers that work here
- Web: Playwright (Chromium, Firefox, WebKit installed) · `npx playwright test tests/qa`
- No device or emulator on this machine

## Parallel lanes
- Copies run side by side: each lane gets its own browser context and its own test user (C, D, E for lanes 3–5), because carts are stored per user on the server
- Lane 1 only: checks that send email (one shared mail catcher inbox)
- (For an app that allows one copy: the lane recipe, each lane's program, data folder and ports, how to reset a lane, and what stays on lane 1. See `platforms/drivers.md`, "Several copies at once")

## App map
| Area | Where | How to reach | Key elements |
|---|---|---|---|
| auth | /login, /signup, /reset | header "Sign in" | email field `#email`, password `#password`, button "Sign in" |
| cart | /cart, cart drawer | header cart icon (`[aria-label="Cart"]`) | quantity input per row, "Checkout" button |

## Waits and timing
- The cart drawer needs about 300 ms after "Add to cart" before it's clickable.
- Image uploads finish processing about 2 s after the progress bar ends.

## Quirks
- The dev server logs a hydration warning on /recipes in development only; it isn't a product bug.

## Don't report
- (Suppressions the user asked for, with the date: "Footer year is intentionally 2025 (2026-11-16)")
```

## Rules

- **Never put real credentials here.** Name environment variables or seed files instead.
- **Stable element references** (labels, roles, test IDs) save turns. Prefer them over CSS chains.
- **Mark anything unverified** with "(unverified)".
- **Testers read only** "How to start", "How to log in", "Drivers that work here", their own lane's lines from "Parallel lanes", their area's row of the app map, "Waits and timing" and "Don't report".
