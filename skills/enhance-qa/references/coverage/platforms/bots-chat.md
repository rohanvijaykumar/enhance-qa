---
module: bots-chat
kind: platform
title: Chat bots (Slack, Discord, Telegram, WhatsApp)
checked: 2026-11-16
---
# Chat bots

Covers bots and apps that live in chat platforms: Slack apps, Discord bots, Telegram bots and WhatsApp Business bots. It covers commands, permissions, message formatting, webhooks and retries, interactive components and platform limits. Bots with an AI brain also load `ai-llm-features.md`; bots with a backend also load `apis-backend.md` and `../features/integrations-webhooks.md`. Security goes to `../features/security.md`.

**Hard rule for this module:** test only in a workspace, server, group or number that the user owns and made for testing. Never message real people, real customers or real channels. Never run load against a platform's API.

## Signals

- Dependencies: `@slack/bolt`, `slack_sdk`, `slack-bolt`, `discord.js`, `discord.py`, `pycord`, `JDA`, `telegraf`, `grammy`, `python-telegram-bot`, `node-telegram-bot-api`, WhatsApp Cloud API calls to `graph.facebook.com`.
- A Slack app manifest (`manifest.json` or `.yml` with `oauth_config`, `event_subscriptions`), a Discord application ID and `intents`, a Telegram bot token variable (`BOT_TOKEN`), a webhook route for `/slack/events`, `/interactions` or `/webhook`.
- README words: "slash command", "bot", "invite", "add to Slack", "BotFather".

## Kickoff questions

1. Which platforms, and is there a private test workspace, server, group or phone number? (best guess: Slack and Discord; a test workspace and server the user creates; if none exist, checks run against a local mock and the live ones go to the user)
2. How does the bot receive events: webhooks (public URL), Socket Mode or gateway, or long polling? (best guess: read the code; tunnel tools like ngrok or cloudflared for local webhooks)
3. Does it store user data, call an outside API or use an AI model? (best guess: read the code; if yes, load the matching modules)

## Drivers

1. **Project tests and a mock platform.** Run the existing tests. Slack Bolt, discord.js and telegraf can be tested by calling handlers with fixture payloads. Record the baseline.
2. **Signed fixture replay.** Write test payloads with the platform's real shapes (Slack event, command and interaction payloads; Discord interaction objects; Telegram `Update`; WhatsApp webhook bodies) and post them to the bot's endpoint with valid signatures made from a test signing secret (Slack `X-Slack-Signature`, Discord Ed25519, WhatsApp `X-Hub-Signature-256`, Telegram `secret_token` header). `curl` or a script is enough. This is deterministic and tests retries, duplicates and bad signatures without a platform [1][2].
3. **Test workspace or server with a bot user.** Slack: a free development workspace (Slack Developer Program sandbox). Discord: a new private server with a test bot token. Telegram: a bot from BotFather and a private test group. Agents drive these with the platform's REST API using the test token from an environment variable, never a pasted credential in a prompt [3][4][5].
4. **Browser driving of the platform web client** (Playwright) for Slack and Discord web, to type slash commands and click buttons. Scoped accessibility snapshots. The user logs in once; the agent never types a real password; the saved session stays git-ignored. Discord's terms discourage automating user accounts (self-bots), so use only the bot API for sending, and a human-logged browser for observing.
5. **Local tunnel** (cloudflared, ngrok) for webhook delivery to a dev machine. Short-lived, to the test workspace only.
6. **WhatsApp.** The Cloud API test phone number and its allowed recipient list (add only the user's own numbers). Template messages need Meta's approval, so treat approved templates as given.
7. **Static checks.** Search for hard-coded tokens, check the manifest's scopes against the API calls in the code, `npm audit`.

**Can't be driven here:** real WhatsApp conversations on a phone, Telegram and Discord mobile clients, Slack's app directory review and Discord's verification for large bots (gate or human), anything that needs the user's personal account. Production workspaces and real customers are never touched.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | test workspace, bot installed, one slash command and one mention in a channel, reply appears |
| check | smoke cell, plus changed commands, plus signature and retry replay |
| full | pairwise over platform × surface (channel, thread, DM, group) × role × message type × client |
| release | every command in every surface and role, a fresh install, uninstall and reinstall, permission removal, plus human checks |

Dimensions: platform; surface (public channel, private channel, thread, DM, group, forum channel); user role (admin, member, guest, bot); client (desktop, mobile, web); message content (plain, markdown, long, attachments, emoji, other languages); delivery mode (webhook, socket or gateway, polling); connectivity (normal, slow, down).

## Check catalogue

### Install, scopes and permissions
- [high · agent] Install the bot into the test workspace or server from scratch with the documented link → install succeeds; the bot appears with its name and icon; the welcome or help message (if any) is correct {smoke}
- [high · auto] Compare the requested scopes (Slack OAuth scopes, Discord permissions and intents, Telegram privacy mode, WhatsApp permissions) with the API calls in the code → no unused broad scope; no missing one that causes a runtime error {security}
- [high · agent] Remove a permission (take away "send messages" in one channel, or the scope in the app settings) and use the bot → a clear explanation or a log line, not a silent failure or a crash loop
- [medium · agent] Use the bot in a channel it hasn't joined or can't read → handles "not in channel" or missing access with a helpful message
- [medium · agent] Uninstall and reinstall → tokens are revoked and re-issued; stored data is removed or kept per the policy; no zombie webhooks
- [medium · agent] Add the bot to a second workspace or server (multi-tenant) and use it in both → data and settings are separate per tenant {security}
- [high · agent] Restricted-role user (guest, member without rights) runs an admin-only command → refused clearly; the action doesn't happen {security}

### Commands and interactions
- [high · agent] Run every slash command with correct arguments → the documented response appears in the right place within the platform's response window (Slack 3 seconds to acknowledge; Discord 3 seconds to respond or defer) {smoke}
- [high · agent] Run every command with no arguments, wrong arguments, very long text, emoji, quotes and mention strings → usage help or a clear error; no stack trace shown in chat
- [medium · agent] Run a command that takes longer than the acknowledgment window → the bot acknowledges at once (Slack `ack`, Discord deferred response) and posts the result later; no "app didn't respond" error
- [medium · agent] Click each button, select menu, modal and message shortcut → the right handler runs; the message updates in place; a second click doesn't repeat the action
- [medium · agent] Click an old interactive message after a bot restart, after the state expired, and as a different user → a clear "expired" or "not for you" reply, not an error
- [medium · agent] Use autocomplete for command options (Discord, Slack typeahead) → suggestions are relevant, fast, capped at the platform's limit
- [medium · agent] Check the command list shown in the platform (names, descriptions, option hints) → matches the code and the docs; no stale or removed commands
- [medium · agent] Mention the bot (`@bot`) at the start, in the middle and in a thread; also reply to the bot's message → responds where the docs say, doesn't respond to its own messages or other bots (no loops)
- [medium · agent] Use the bot in a public channel, a private channel, a thread, a DM and a group → behaves as documented in each; private data is never posted to a public place by accident

### Messages and formatting
- [high · agent] Send messages with each format the bot uses (Slack mrkdwn and Block Kit, Discord markdown and embeds, Telegram HTML or MarkdownV2, WhatsApp text and templates) → renders correctly in the real client, not as raw markup {smoke}
- [medium · agent] Include characters that break formatting (`_ * [ ] ( ) ~ > # + - = | { } . !` for Telegram MarkdownV2, backticks, angle brackets) in dynamic text → escaped; the message still sends
- [medium · agent] Send text at and over the platform's message length limit and attachments at the size limit → split or truncated sensibly with a note; no "message too long" error to users
- [medium · agent] Mention users, channels and roles from dynamic data → mentions resolve and notify only the intended people; user-supplied `@everyone`, `@here` and `<!channel>` are neutralised {security}
- [medium · agent] Post in a thread, reply in thread, broadcast to the channel, and edit or delete a bot message → threading is right; edits and deletes work; deleted-message handling doesn't crash
- [medium · agent] View the messages on mobile and desktop and in dark mode → layout readable; buttons not cut off; images have alt text and links work {a11y}
- [low · agent] Use non-English text, right-to-left text and long unbroken words → text is intact and readable
- [medium · agent] Check the rate of messages the bot sends in a burst (a command that posts to many channels) → paced within platform limits; no flood

### Webhooks, retries and idempotency
- [high · auto] Post a fixture payload with a wrong signature, no signature and an old timestamp → rejected with 401 or 403; the handler logic doesn't run {security}
- [high · auto] Post the same event twice (Slack retry headers `X-Slack-Retry-Num`, repeated `event_id`, Telegram repeated `update_id`, WhatsApp repeated message IDs) → processed once; the user sees one reply
- [high · auto] Delay the bot's HTTP response beyond the platform's timeout, then respond → the retry doesn't cause a second action; the slow path acknowledges first
- [medium · auto] Send events out of order, a message edit before its create, and a delete for an unknown message → handled without a crash
- [medium · auto] Send malformed JSON, unknown event types, huge payloads and unexpected fields → 4xx for bad input, 200 for harmless unknown types; no crash or log flood
- [medium · agent] Stop the bot for a while, send messages, restart → documented behaviour: missed events are retried by the platform, or the bot says it was offline; no duplicate processing after catch-up
- [medium · agent] Handle URL verification and webhook registration (Slack `url_verification` challenge, Telegram `setWebhook`, WhatsApp verify token) → the handshake succeeds and rejects a wrong token {security}
- [medium · agent] Kill the connection (Socket Mode, Discord gateway) and restore it → reconnects with backoff; resumes the session where the platform allows; doesn't miss or duplicate commands

### Platform limits and errors
- [high · auto] Mock a 429 response with a `Retry-After` header (Slack, Discord, Telegram `retry_after`, WhatsApp) → the bot waits as told, retries, and doesn't hammer the API; users get a clear delay message if long
- [medium · auto] Mock API errors (5xx, timeouts, `invalid_auth`, `channel_not_found`, "Forbidden: bot was blocked by the user", deleted user) → handled, logged without the token; the bot keeps running
- [medium · agent] Check that the bot never sends more than the platform allows without consent (Telegram bot blocked by user, WhatsApp 24-hour customer service window and template rules, Slack opt-in) → no unsolicited messages; opt-out is honoured
- [medium · agent] Check Telegram group privacy mode and Discord message-content intent behaviour → the bot sees only what it's meant to; no reliance on an intent it doesn't have
- [medium · agent] Run the bot's own user-facing help and error text → accurate, polite, in the right language, no internal IDs or raw error codes

### Data, privacy and security
- [high · auto] Search the repo, logs and a fresh error report for bot tokens, signing secrets and OAuth tokens → none present; secrets come from environment variables {security}
- [high · agent] Check what the bot stores: message contents, user IDs, emails, tokens → only what's needed; stored tokens encrypted; retention and deletion work (uninstall, "forget me" command) {security}
- [high · agent] Send user text containing links, `javascript:` URLs, markdown injection and fake system messages → no execution; links shown safely; the bot doesn't treat chat content as commands to itself {security}
- [medium · agent] Check that the bot ignores or limits messages from other bots and from itself → no reply loops; bots can't trigger admin actions
- [medium · agent] Check OAuth redirect and state handling for the install flow → state parameter validated; the redirect URL is fixed; tokens not in URLs {security}
- [medium · agent] Check that private-channel or DM content isn't leaked into logs, analytics or third-party services without disclosure {security}

### Reliability and operations
- [medium · agent] Restart the bot mid-conversation and mid-interaction (a modal open) → the user gets a sensible result or a retry message
- [medium · agent] Run the bot's scheduled jobs (reminders, digests) in a test channel across a time-zone change and daylight-saving boundary → fire once, at the right local time
- [medium · agent] Check health and status endpoints, logs and error reporting after failures → useful, with no personal data
- [low · agent] Leave the bot running for a few hours in the test workspace with light traffic → no memory growth, reconnect storms or growing latency

## Gates

Directory listings and verification (Slack App Directory review, Discord bot verification and privileged intents approval, WhatsApp Business verification and template approval, Telegram has none) are human steps. Block release on:

- Signature verification missing or bypassable.
- Duplicate processing of retried events.
- Secrets in the repo or logs.
- The bot messages people who didn't opt in, or replies to itself or other bots in a loop.
- A scope or permission broader than the features need.
- Commands that miss the platform's acknowledgment window in normal use.

## Human-only checks

- [human] In your own test workspace, use the bot on your phone and desktop for ten minutes the way a team would → is it clear, quick and polite, and does it ever feel spammy?
- [human] Read the permission screen that users see when installing → do the scopes match what you'd tell users the bot does?
- [human] Check the WhatsApp templates and any opt-in wording with whoever owns compliance → acceptable.
- [human] Submit the app for directory review or verification with your account → approved. (Agents never submit.)
- [human] Read the bot's help text and error messages as a new user → friendly, accurate, correct tone.

## Known pitfalls

- **"App didn't respond" in Slack** is often a cold start on a free host, not a logic bug. Retry once; record n/N.
- **Retries look like duplicates.** Slack retries when the response is slow; check the retry header before reporting a duplicate as a bug in the platform.
- **Discord slash command changes take time** (global commands can be slow to propagate; guild commands are fast). Don't file a stale command list until you've re-synced.
- **Telegram privacy mode** hides most group messages from bots by default; a bot "not seeing" messages may be correct.
- **WhatsApp sandbox numbers** can message only added recipients; failures to others are by design.
- **Rate-limit responses in tests** are the platform working. Don't loop to provoke them on the real API; use mocks.
- **Ephemeral messages** (visible to one user) can't be seen by an observer account; check as the right user.
- **Message edits and embeds may render differently** on mobile; check the real client before calling it a defect.
- **Don't automate a personal user account** on Discord or WhatsApp. It breaks their terms and can get the account banned.

## Sources

1. [Slack: verifying requests from Slack](https://api.slack.com/authentication/verifying-requests-from-slack) — signing secret and timestamp checks (checked 2026-11-16)
2. [Slack: Events API (retries and acknowledgment)](https://api.slack.com/apis/events-api) — 3-second acknowledgment, retry behaviour (checked 2026-11-16)
3. [Slack: rate limits](https://api.slack.com/apis/rate-limits) — HTTP 429 and `Retry-After` (checked 2026-11-16)
4. [Discord: receiving and responding to interactions](https://discord.com/developers/docs/interactions/receiving-and-responding) — response window, deferred responses, signature verification (checked 2026-11-16)
5. [Telegram Bot API](https://core.telegram.org/bots/api) — updates, webhooks, `secret_token`, `retry_after`, formatting options (checked 2026-11-16)
6. [WhatsApp Business Platform: Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — webhooks, templates, test numbers (checked 2026-11-16)
7. [Discord developer terms and policy](https://discord.com/developers/docs/policies-and-agreements/developer-policy) — bot rules; no self-bots (checked 2026-11-16)
