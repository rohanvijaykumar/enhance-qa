---
module: payments-subscriptions
kind: feature
title: Payments and subscriptions
checked: 2026-11-16
---
# Payments and subscriptions

Checkout, one-off payments, subscriptions, refunds, webhooks, invoices, tax and entitlements. Test mode only. Going live (real cards, real money, account activation) is human-only. In-app purchases on iOS and Android are covered in the platform modules and gate packs; this pack covers the shared logic. Usually goes with `accounts-auth.md`, `notifications.md`, `integrations-webhooks.md` and `security.md`.

## Signals

- Dependencies: `stripe`, `@stripe/stripe-js`, `@paddle/paddle-js`, `lemonsqueezy`, `braintree`, `adyen`, `razorpay`, `paypal`, `@polar-sh`, RevenueCat, `expo-in-app-purchases`.
- Routes: `/checkout`, `/pricing`, `/billing`, `/webhooks/stripe`, `/api/subscribe`; tables `subscriptions`, `invoices`, `plans`, `orders`.
- Environment variables with `STRIPE_`, `PADDLE_`, `WEBHOOK_SECRET`.
- README or UI: "Pro plan", "free trial", "upgrade", "cart".

## Kickoff questions

1. Which provider and which mode is configured? Confirm test keys only. (best guess: Stripe, `sk_test_` keys)
2. What products exist: one-off, subscription, usage-based, seats? (best guess: monthly and yearly subscription)
3. What does a paying user get, and what must stop when payment stops? (best guess: a paid feature flag that turns off on cancel or failed renewal)

## Drivers

1. **Provider test mode plus test cards.** Always. Stripe, Paddle, Braintree and others publish test card numbers that behave in set ways (success, decline, insufficient funds, 3-D Secure required). Use only those numbers; take them from the provider's testing page, never from memory.
2. **Provider CLI and webhook forwarding.** `stripe listen --forward-to localhost:PORT/webhook` and `stripe trigger <event>` send signed test events to a local server. Paddle and others offer a simulator. Use these instead of waiting for real renewals.
3. **Test clocks.** Stripe test clocks advance time to test trials ending, renewals, proration and failed-renewal retries in seconds. Use them instead of waiting.
4. **Playwright through the hosted checkout.** The agent fills in test card details on the provider's hosted page or iframe. Use frame locators for embedded fields; observe with scoped accessibility snapshots.
5. **HTTP client for webhooks.** Replay the same signed event twice, send a bad signature, send events out of order. Check state in the database afterwards.
6. **Database and provider dashboard (test mode) read.** Confirm the end state: order row, subscription status, entitlement flag, invoice record. Compare to the provider's test dashboard.

**Can't be driven here:** live-mode payments, real bank transfers, real wallet payments (Apple Pay, Google Pay need real devices and wallets), real 3-D Secure bank prompts, payouts, tax registration, and the provider's go-live review. These are human or gate checks. App Store and Play sandbox purchases need devices or simulators signed into sandbox accounts; see the platform modules.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | test card success, then the paid thing is unlocked |
| check | smoke, decline path, webhook received, plus what the change touched |
| full | pairwise over plan, interval, card outcome, new vs existing customer, currency, browser |
| release | all cells, plus test-clock lifecycle, refunds, human live-mode checklist |

Dimensions: plan and interval, card outcome (success, decline, 3-D Secure, expired), customer state (new, trialing, active, past due, canceled), currency and country, coupon or none, tax-inclusive or exclusive.

## Check catalogue

### Checkout (one-off)
- [high · agent] Buy the cheapest item with the provider's success test card → confirmation page, order stored once, confirmation email in the catcher, access or goods granted {smoke}
- [high · agent] Amount on the cart, the checkout page, the receipt and the provider's test dashboard → all identical, in the same currency, rounding correct
- [high · agent] Change the price or quantity in the browser request (devtools or HTTP client) → server ignores the client value and charges the server-side price {security}
- [medium · agent] Empty cart, quantity 0, negative quantity, max quantity, removed item → clear messages, no zero or negative charge
- [medium · agent] Apply, remove and stack coupons; expired and wrong codes; a coupon on a free item → correct totals and messages; no negative totals
- [medium · agent] Guest checkout vs signed in (where both exist) → the order attaches to the right account, and the receipt goes to the right email
- [medium · agent] Double-click Pay, press Back after paying, refresh the confirmation page → one charge and one order {smoke}
- [medium · agent] Close the tab at the provider page, or cancel → back to the app with an "unpaid" state; no order marked paid; cart kept

### Cards, failures and 3-D Secure
- [high · agent] Declined card, insufficient funds, expired card and wrong CVC test cards → each gives a readable message; the user can retry with another card; no order marked paid
- [high · agent] 3-D Secure test card that requires authentication: complete it, fail it, and abandon it → complete: paid; fail: declined message; abandon: unpaid, and recoverable
- [medium · agent] Card entry: paste, autofill, spaces in the number, wrong length → provider field validates inline; the app doesn't show a raw provider error
- [medium · agent] Network drop during the payment confirmation (throttle or offline, then recover) → the order ends in one correct state; the user is told what happened; nothing is charged twice
- [medium · agent] Payment succeeds at the provider but the redirect back is lost → the webhook still marks the order paid; the user sees paid status on next visit

### Webhooks and idempotency
- [high · auto] Send a valid signed test event → app responds 2xx quickly and updates state once {smoke}
- [high · auto] Send the same event ID twice → second is ignored; no duplicate order, email or credit
- [high · auto] Send an event with a bad or missing signature, or an old timestamp → rejected (4xx); state unchanged {security}
- [medium · auto] Send events out of order (for example `invoice.paid` before `customer.subscription.created`) → app copes, ends in the right state
- [medium · auto] Make the handler fail once (return 500 on the first attempt) and let the provider retry → ends in the right state with one effect
- [medium · agent] Webhook endpoint down for a while, then up → provider retries; events are processed after recovery
- [medium · auto] Create-payment API calls are retried with the same idempotency key → one payment object; a different key makes a new one

### Subscriptions
- [high · agent] Subscribe with a test card → status active, plan shown correctly on the billing page, paid features unlocked, first invoice created {smoke}
- [high · agent] Start a free trial; the trial ends (test clock) → converts and charges if a card is present; otherwise cancels cleanly; user is warned before it ends
- [high · agent] Cancel → access continues to period end (or stops now, per the docs); the status and the next invoice date are right; a cancel email arrives
- [medium · agent] Reactivate a canceled subscription before the period ends → no double charge; status active again
- [medium · agent] Upgrade mid-cycle → prorated charge or credit matches the provider's invoice preview; features unlock at once
- [medium · agent] Downgrade → takes effect at the stated time; features beyond the new plan's limits are locked or flagged, and no data is deleted without warning
- [medium · agent] Renewal (test clock) → new invoice paid, period dates advance by exactly one interval; the month-end case (31st) behaves as documented
- [high · agent] Renewal fails (test card that fails on renewal) → status past due, retries follow the settings, the user gets a dunning email with an update-card link, access follows the stated grace rule
- [medium · agent] Update payment method; pay an overdue invoice → status returns to active; paid features come back
- [medium · agent] Change seats or quantity (where offered) → proration right, limits enforced
- [medium · agent] Customer portal or billing page (hosted by the provider or custom) → shows the same plan, dates and amounts as the app; the return link works

### Refunds and disputes
- [high · agent] Issue a full refund in test mode from the dashboard or admin → provider shows refunded, webhook received, app revokes access or credit, refund email sent
- [medium · agent] Partial refund → amounts correct on invoice and in the app; entitlement matches the policy
- [medium · agent] Dispute test card (where the provider offers it) → app handles the dispute event without crashing; access follows the stated policy
- [medium · agent] Refund after the subscription was canceled or upgraded → balances correct; no negative states

### Receipts, invoices, tax and currency
- [high · agent] Open the receipt and invoice PDF or page → business name, customer name, date, line items, tax and total match the checkout; invoice numbers are sequential and unique
- [medium · agent] Tax or VAT: test addresses in two countries, with and without a tax ID → tax line and total match the provider's calculation; tax-inclusive vs exclusive display is consistent
- [medium · agent] Currency: switch locale or country → symbol, decimal separator and currency code match; zero-decimal currencies (such as JPY) show no cents; the charged currency matches what was shown
- [medium · agent] Billing details (name, address, company, tax ID) → saved, appear on the next invoice, and can't be edited into another user's invoice {security}
- [low · agent] Receipt and invoice emails render without broken images, in plain-text fallback too

### Entitlement after payment
- [high · agent] After payment, the paid feature unlocks without a manual refresh or relogin, and works on a second device → entitlement read from the server, not just the client {smoke}
- [high · agent] Free user calls the paid API or opens a paid URL directly → refused (403 or paywall), not just hidden in the UI {security}
- [high · agent] After cancel, expiry or refund → paid access ends at the right moment, on every path (UI, API, files, exports)
- [medium · agent] Two tabs or two devices at once (one pays, the other stays open) → the other updates after the next request; no stale "Upgrade" button forever
- [medium · agent] User A's payment must not unlock features for user B, and a shared customer ID must not cross accounts {security}

### Safety of the integration
- [high · auto] Search the repo and built client bundle for live keys (`sk_live_`, `rk_live_`) and secret keys → none in client code, git history, or logs {security}
- [high · auto] Server logs and error pages during failed payments → no card numbers, full tokens or secrets
- [medium · agent] Webhook and checkout URLs, success and cancel URLs → use the right environment's domain, not localhost, in production-like config

## Gates

- Test-mode run of success, decline, 3-D Secure, refund and cancel all passes.
- Webhooks are signed-checked and idempotent.
- Prices come from the server; entitlement is enforced by the server.
- No secret or live keys in client code or the repo.
- Go-live checklist from the provider completed by a human (see Human-only checks).

## Human-only checks

- [human] Run the provider's go-live checklist: activated account, live keys set in production only, live webhook endpoint and signing secret set, statement descriptor, support contact, refund and terms pages published
- [human] One live payment of the smallest amount on your own card, then refund it → charge, receipt, webhook and entitlement behave like test mode; this is the only real-money step, and only the owner runs it
- [human] Apple Pay or Google Pay on a real device and wallet → sheet shows the right name and amount; payment completes in test mode
- [human] Read the pricing page, checkout and receipts as a customer → prices, trial and renewal terms are clear, with no surprise charges; legal wording is right for the countries sold in
- [human] Tax setup and registrations with an accountant → right rates and invoice fields for each market

## Known pitfalls

- **Test cards only work in test mode.** A live-mode key with a test card gives a decline; that's expected, and it also means you used the wrong key. Stop and check the mode.
- **Webhooks may arrive late or out of order.** A "paid" state a second or two after the redirect is normal; wait and re-check before filing.
- **Test clocks don't affect everything.** Provider emails and some dashboard timestamps keep real time.
- **Proration differs by settings.** Compare to the provider's invoice preview, not your own arithmetic.
- **Rounding of tax-inclusive prices** can differ by a cent between providers; compare to the provider's total.
- **3-D Secure test pages look odd.** The provider's fake bank screen is not a bug in the app.
- **Hosted checkout isn't the app.** Layout problems inside the provider's page are not app defects, unless the app configured them.
- **Duplicate customers** in the test dashboard come from repeated test runs; clean test data, don't report it.
- Don't test with real cards, real customers' data or in live mode, and never retry payment actions in a loop.

## Sources

1. [Stripe: testing](https://docs.stripe.com/testing) — test cards, 3-D Secure and decline cards (checked 2026-11-16)
2. [Stripe: webhooks](https://docs.stripe.com/webhooks) — signatures, retries, ordering, duplicates (checked 2026-11-16)
3. [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests) — idempotency keys (checked 2026-11-16)
4. [Stripe: test clocks](https://docs.stripe.com/billing/testing/test-clocks) — simulating subscription time (checked 2026-11-16)
5. [Stripe: go-live checklist](https://docs.stripe.com/get-started/checklist/go-live) — human go-live steps (checked 2026-11-16)
6. [Paddle developer docs](https://developer.paddle.com/) — sandbox and simulator (checked 2026-11-16)
7. [Android: test Play Billing](https://developer.android.com/google/play/billing/test) and [Apple: StoreKit sandbox testing](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox) — mobile in-app purchase test modes (checked 2026-11-16)
8. Research notes: `11-vibe-coders.md` (AI-built apps trust client prices and skip webhook checks)
