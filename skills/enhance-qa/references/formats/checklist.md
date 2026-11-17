# Checklist format

The checklist is one list for the whole product, stored as one file per area in `qa/checklist/`.
- **Areas** are the parts a user sees (auth, cart, checkout, settings), plus app-wide ones (accessibility, security, performance, release).
- **Splitting it this way** keeps runs cheap, because testers load only the area they test. It also lets parallel testers write without clashing.
- **`qa export`** joins all areas into one list.

## An area file

```markdown
# Cart
- Area: CART
- Paths: src/cart/**, app/(shop)/cart/**, api/cart*
- Modules: web-app, payments-subscriptions
- Notes: Guests' carts live in localStorage; signed-in users' carts are in the database.

### CART-001 · Adding an item updates the cart badge
- Risk: high · Type: agent · Tags: smoke
- Steps: Open any product → click "Add to cart"
- Expect: The cart badge shows 1 within a second, and the item is listed in the cart
- Source: README (cart)

### CART-004 · Removing the last item shows the empty cart
- Risk: high · Type: agent · Tags: regression
- Steps: Add one item → open the cart → remove it
- Expect: "Your cart is empty" with a "Continue shopping" link; the cart badge shows 0
- Source: BUG-012
```

**Header** (the `- Key: value` lines before the first check):

| Key | Required | Meaning |
|---|---|---|
| `Area` | yes | The ID prefix: 2–12 capital letters or digits, unique across files |
| `Paths` | yes for product areas | Comma-separated globs of the code that implements this area, used by `qa select` to map a diff to checks. App-wide areas use `*` |
| `Modules` | no | Coverage modules this area draws on |
| `Notes` | no | One or two lines of context |

## A check

A `###` heading with the ID, a `·` and a short title saying what must be true, followed by `- Key: value` lines. Several keys can share a line, separated by ` · `. A long value can continue on the next lines, indented by two spaces.

| Key | Required | Values |
|---|---|---|
| `Risk` | yes | `high`, `medium`, `low`. Sets the order and which checks run in quick passes |
| `Type` | yes | `auto` (a command or validator decides), `agent` (an agent drives the product and judges), `human` (needs a person's judgement), `device` (needs real hardware), `gate` (an external submission or certification) |
| `Tags` | no | Comma-separated. Common: `smoke`, `regression`, `prod-safe`, `release`, `security`, `a11y`, `visual`, `exploratory`, `flaky`, `escaped`, `replay` |
| `Steps` | yes, except `auto` | What to do, in order, separated by `→`. Real names, real data, real labels |
| `Command` | for `auto` | The command to run, and how to read its result |
| `Expect` | yes | The observable expected result, written before testing. Text, state, timing, what must not happen |
| `Source` | yes | The oracle: `README (section)`, a doc path, `spec`, a heuristic (`base: data tour`), a module (`features/accessibility`), `BUG-NNN`, `user decision 2026-11-16`, `imported (file)` |
| `Env` | no | Matrix cells it needs, for example `chrome-phone, safari-desktop`. Default: the tier's cells |
| `Data` | no | Test data it needs: `test user A`, `a product with 0 stock` |
| `Replay` | no | Path to an automated script that runs this check (`tests/qa/cart-004.spec.ts`) |
| `Assumed` | no | `yes` when the lead chose the expected result on Autopilot |
| `Question` | no | An unclear expected result for the user. The check waits until it's answered |
| `Retired` | no | `<date> <reason>`. Kept for history; not run |

**Exploratory charters** are checks too: `Type: agent`, `Tags: exploratory`, `Steps:` the mission and time box, `Expect:` "No S1–S3 problems; notes say what was covered". For example:
`### CART-020 · Charter: the money tour through cart and checkout`.

## Rules

- **One check tests one thing.** A small web app typically has 60–150 checks; a large one 300–500.
- **Expected results come from an oracle** (`coverage/base.md` "Name the oracle"), never from what the code happens to do. If no oracle answers, write a `Question`.
- **IDs are permanent.** Get the next free one with `qa next-id check CART`.
- **Human, device and gate checks** carry exact steps, so the user can do them in a few minutes.
- **Regression checks** added after a verified bug have `Tags: regression` and `Source: BUG-NNN`.
- **`qa hash --record`** at the start of each run fingerprints every check's Type, Risk, Steps, Command and Expect. `qa gate` fails if any of them changes while testers, the verifier or the fixer are working.
