---
module: admin-backoffice
kind: feature
title: Admin and back-office tools
checked: 2026-11-16
---
# Admin and back-office tools

Internal and admin screens: user management, moderation, content and order management, support tools, feature flags, reports and exports. Focus: who can reach them, what they can break, and whether actions leave a trail. Usually goes with `accounts-auth.md`, `security.md`, `data-import-export.md` and `search-filter-sort.md`.

## Signals

- Routes: `/admin`, `/backoffice`, `/dashboard/admin`, `/staff`, `/internal`, `/manage`.
- Frameworks: Django admin, Rails Admin / ActiveAdmin, Laravel Nova / Filament, Retool, Refine, React-Admin, Strapi, Directus, Payload, WordPress `wp-admin`, Supabase service-role usage.
- Roles or flags named `admin`, `is_staff`, `superuser`, `moderator`, `support`.
- Features: impersonate, ban, refund, bulk delete, export users, audit log.

## Kickoff questions

1. Which roles reach the admin area, and which actions are meant for only some of them? (best guess: admin and support)
2. Is there an audit log or impersonation, and how many records are in the test data? (best guess: no impersonation; seed 500+ records for bulk tests)
3. Is the admin a separate app or origin from the public product? (best guess: same app, role-gated)

## Drivers

1. **HTTP client with different identities.** Best for access control. Call every admin route and API as anonymous, as a plain user, as each admin role, and with an expired session. Compare status codes. Generate the route list from the router or an OpenAPI file.
2. **Playwright with one context per role.** Drives real flows: filters, bulk selection, confirm dialogs, exports. Scoped accessibility snapshots keep cost down; act on a batch of rows then observe once.
3. **Database read (read-only) and seed scripts.** Confirm that a delete is really soft or hard, that audit rows exist, and that the admin edit changed only the intended row. Seed large lists with the project's seed script, never with production data.
4. **Download inspection.** Save exports to a scratch folder; open with a CSV or JSON parser and compare to the database.
5. **Framework introspection.** For Django, Rails and Laravel admins, list registered models and permissions with the framework command, then compare to the intended access.

**Can't be driven here:** SSO into a corporate identity provider, hardware-key admin login, and anything that touches production data. These are human checks, and production stays read-only.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | admin signs in, opens the main list, opens one record; plain user is refused |
| check | smoke, plus each admin action the change touched, as admin and as non-admin |
| full | pairwise over role, action, list size, browser |
| release | every admin route as every identity; bulk, export and impersonation sweeps; human review |

Dimensions: role (anonymous, user, support, admin, superadmin), action type (view, edit, delete, bulk, export, impersonate), data size (0, 1, 500+), record state (active, suspended, deleted).

## Check catalogue

### Access control (the server decides)
- [high · auto] List every admin page and admin API route; request each with no session, with a plain user's session, and with each lesser admin role → 401 or 403 for all except the intended roles; no admin data in the body {smoke} {security}
- [high · auto] Admin frontend bundle and API: find admin-only endpoints called by hidden UI → each still enforces the role on the server {security}
- [high · agent] Plain user types the admin URL, or opens it from history after losing the role → redirect or 403, not a flash of admin content
- [high · auto] Replay an admin action's request (copied from the network log) using a plain user's cookie → refused, state unchanged {security}
- [medium · agent] Demote an admin while their session is open → next request is refused; the admin can't keep acting on a stale role
- [medium · auto] Admin API uses an IDOR-style ID (`/api/admin/users/123`) as a lesser role or as another tenant's admin → refused; admins of tenant A can't see tenant B {security}
- [medium · agent] Admin area on a separate origin or path: cookies, CORS and CSRF protection work (state-changing admin requests need a token or same-site cookie) {security}
- [high · auto] No service-role or admin keys shipped in client code or visible in network responses {security}

### Authentication of staff
- [high · agent] Admin sign-in requires 2FA where the docs promise it; recovery paths exist → code required; no skip by URL
- [medium · agent] Admin session idle timeout shorter than the normal timeout (if specified) → expires and prompts
- [medium · agent] Failed admin logins are throttled and logged

### Data views and edits
- [high · agent] Open a list with 0, 1 and 500+ records → empty state, single row, paging or virtual scroll all right; counts match the database {smoke}
- [high · agent] Edit a record in the admin → change appears in the public product, in search and in exports; only that record changed
- [medium · agent] Edit with invalid, empty, very long or script-like values → validated by the server; the stored value is escaped when shown to other admins and users {security}
- [medium · agent] Two admins edit the same record → conflict warning or last-write-wins stated; no silent overwrite
- [medium · agent] Edit while a user is using the record (user session open) → user sees the update or a clear stale state on the next load
- [medium · agent] Admin sees fields users never should (hashes, tokens, internal notes) → secrets are masked; hashes and API keys are never displayed in full {security}
- [medium · agent] Search, filter and sort in admin lists → see `search-filter-sort.md`; also check filters survive pagination and a page reload

### Bulk actions
- [high · agent] Select 3 rows, apply a bulk action (delete, suspend, change status) → exactly those rows change; a summary says how many succeeded and failed
- [high · agent] "Select all" across pages vs only the visible page → the label says which; the action applies to the chosen scope only
- [medium · agent] Bulk action with one row that will fail (locked, referenced, missing) → partial result reported row by row; the rest are applied or all are rolled back, as documented
- [medium · agent] Bulk action on 500+ rows → completes or runs as a background job with progress; no timeout with a half-done state
- [medium · agent] Cancel or close the page during a bulk action → state is consistent and visible afterwards
- [medium · agent] Bulk action while filtered → applies to the filtered set, not the whole table

### Dangerous actions
- [high · agent] Delete, purge, ban, refund, reset password, change role, revoke keys → each needs a clear confirmation naming the target and the effect; Esc and Cancel do nothing {smoke}
- [high · agent] Confirm a delete → record is removed or soft-deleted as documented; dependent records, files and subscriptions are handled; undo or restore exists where promised
- [medium · agent] Admin deletes themselves or the last admin → blocked with a message
- [medium · agent] Dangerous action by double-click or key repeat → runs once
- [medium · agent] Admin triggers a user-facing email or notification (reset, ban notice) → goes to the catcher only in test; text and recipient are right

### Audit logs
- [high · agent] Perform edit, delete, role change, export and login as admin → each creates an audit entry with who, what, which record, when, and (where useful) before and after values {security}
- [medium · agent] Audit log itself → can't be edited or deleted by admins from the UI or API; entries cover failed and denied attempts too
- [medium · agent] Audit timestamps and time zone → right and consistent; sorted newest first; filterable by user and action
- [low · agent] Audit log with 10,000+ entries → pages and filters stay responsive

### Impersonation (where offered)
- [high · agent] Start "view as user" → a persistent banner shows who is impersonated and a clear way to stop; the real admin is recorded in the audit log {security}
- [high · agent] While impersonating, try risky actions (change password, change email, delete account, payments, see secrets) → blocked or clearly confirmed per the docs {security}
- [medium · agent] Stop impersonating → back to the admin identity; no leftover user cookie; the user receives a notice if the docs promise one
- [medium · agent] Plain users and lesser admins try to start impersonation by API → refused

### Exports and reports
- [high · agent] Export users or orders → file opens; row count and totals match the screen and the database; honors current filters; only data the role may see
- [medium · agent] CSV export with values starting `=`, `+`, `-` or `@` → neutralized so a spreadsheet won't run them (see `data-import-export.md`) {security}
- [medium · agent] Export of large lists → finishes, or becomes an async job with a download link; the link is private and expires {security}
- [medium · agent] Reports and dashboards: totals vs raw data, date ranges and time zones, empty periods → numbers reconcile

### Operations
- [medium · agent] Feature flags or settings toggled in admin → effect visible in the product within the stated time, and reversible
- [medium · agent] Admin on a phone-width window and on keyboard only → critical actions are reachable; focus is visible and dialogs are trapped correctly {a11y}
- [low · agent] Admin labels and error text → plain; no raw IDs, "undefined" or stack traces

## Gates

- Server-side role checks on every admin route and API (all high-risk access lines pass).
- Dangerous actions confirmed, and audited.
- No secrets or service keys exposed to the client.
- Exports are permission-checked and neutralized against formula injection.

## Human-only checks

- [human] Sign in to the staging admin with the real staff SSO and hardware key → works, and revoking a person's access removes it at once
- [human] Walk a support scenario as a new support agent (find a customer, refund in test mode, add a note) → is the tool understandable and safe, with no easy way to hit the wrong customer?
- [human] Review the audit log with your compliance or security person → fields are enough to answer "who did what, when"

## Known pitfalls

- **Hidden menu isn't protection, but a visible menu isn't a bug either.** Judge access by the server's response, not by what the UI shows.
- **Framework admins show everything by design.** Django and Rails admin showing hashed passwords or raw JSON fields to superusers may be the framework's default; flag only if lesser roles see it.
- **Soft delete.** A record that disappears from the list but remains in the database may be intended; check the docs.
- **Seeded data is fake.** Admin counts won't match production; compare against the test database only.
- **Rate limits and CAPTCHAs on admin login** can block automation; use a seeded session instead of bypassing them.
- Never run bulk or destructive actions against shared or production data, and never use real customers' records for impersonation tests.

## Sources

1. [OWASP ASVS](https://asvs.owasp.org/) — access control, logging requirements (checked 2026-11-16)
2. [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — enforce on the server, deny by default (checked 2026-11-16)
3. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) — audit log contents (checked 2026-11-16)
4. [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) — export neutralization (checked 2026-11-16)
5. Research notes: `11-vibe-coders.md` (service-role keys and missing role checks in AI-built apps), `5-software-types.md` (API authorization defects)
