---
module: realtime-collaboration
kind: feature
title: Real-time and collaboration
checked: 2026-11-16
---
# Real-time and collaboration

Live updates and shared editing: WebSockets, Server-Sent Events, long polling, presence, chat, live cursors, shared documents, multiplayer state. Focus: two or more people at once, flaky connections, and ordering. Offline queues and merge are in `offline-sync.md`; permissions in `accounts-auth.md`; games' netcode in `../platforms/games.md`. Usually goes with `web-app.md` and `performance.md`.

## Signals

- Dependencies: `socket.io`, `ws`, `Phoenix Channels`, `ActionCable`, `SignalR`, `Pusher`, `Ably`, `PartyKit`, `Liveblocks`, `Yjs`, `Automerge`, `ShareDB`, `Supabase Realtime`, `Firebase Realtime Database` or Firestore listeners, `EventSource`.
- UI: "typing…", avatars of online users, live cursors, "someone else is editing", unread counts that update by themselves.
- Server endpoints `/ws`, `/socket.io`, `/events`, `/stream`.

## Kickoff questions

1. What must update live, and how fast? (best guess: lists and chat within 1 to 2 seconds)
2. Can two people edit the same thing at once, and how are conflicts meant to resolve? (best guess: last write wins with a warning, or a CRDT for documents)
3. Max users in one room or document in real use? (best guess: under 20; test with 2, 5 and a stress of 50 with scripts, locally only)

## Drivers

1. **Playwright with two or more browser contexts.** Best default. Each context is an independent user and cookie jar. Act in A, observe in B. Use `page.routeWebSocket` and `context.setOffline(true)` to drop and restore connections. Use scoped accessibility snapshots; wait on the element, not a sleep.
2. **Scripted WebSocket or SSE clients** (`wscat`, `websocat`, Node `ws`, `curl -N` for SSE). Test the protocol directly: bad frames, out-of-order messages, duplicate IDs, unauthorized subscriptions, reconnect with a stale cursor or last-event ID.
3. **Network shaping.** Chrome DevTools throttling, Playwright offline, `tc netem` (Linux), Network Link Conditioner (macOS), Clumsy (Windows) for latency, loss and drops. Local only.
4. **Server logs and metrics.** Connection counts, message rates, errors, memory over time.
5. **Mobile devices and simulators** for background and foreground switching of connections.

**Can't be driven here:** many-hundred-user load tests against shared or third-party services (no load testing of services you don't own; use a local load tool against a local server only, as a separate approved task), real cellular network handoffs, and device sleep on real phones. These are device or human checks.

## Default matrix

| Tier | Cells |
|---|---|
| smoke | two sessions: action in A appears in B |
| check | smoke, plus reconnect and the changed feature |
| full | action x session count x network state x permission state |
| release | all of full, conflict sweep, soak (30 minutes), device background checks |

Dimensions: transport (WebSocket, SSE, polling fallback), number of sessions, network (good, slow, dropped, flapping), page state (foreground, background tab, sleeping), permission state, browser, proxy or corporate firewall.

## Check catalogue

### Live updates (two sessions)
- [high · agent] User A creates, edits and deletes an item; user B has the same view open → B sees each change without reload within the target time, with correct data and order {smoke}
- [high · agent] Updates for items B isn't allowed to see (private, other workspace) → never delivered to B's connection {security}
- [medium · agent] B is on a different page, tab or filter when the update arrives → counts and badges update; the current view isn't disrupted (no scroll jump, no lost typing or focus)
- [medium · agent] Lists with sorting and filters get a live insert → item lands in the right place, or a "new items" pill appears; filters still apply
- [medium · agent] Same user in two tabs and two devices → both stay in sync; own actions aren't shown twice (echo)
- [medium · agent] Updates while paused: B's tab in the background for 5 minutes, then foreground → state is current within a short time; no flood of stale animations

### Presence and typing
- [high · agent] A joins, leaves, closes the tab and loses the network → B sees online, then offline within the documented timeout; no ghost users
- [medium · agent] Typing indicators → appear on typing, vanish after stop or send; not stuck after a disconnect
- [medium · agent] Live cursors and selections → move smoothly, show the right name and color, disappear on leave; positions stay correct when text changes
- [medium · agent] Many users in one room (10 to 50 scripted) → presence list stays correct and the UI stays responsive; large lists are capped or summarized
- [medium · agent] Presence privacy → hidden or invisible status and "last seen" settings are honored {security}

### Concurrent edits and conflicts
- [high · agent] A and B edit different fields of the same record at once → both changes are kept {smoke}
- [high · agent] A and B edit the same field at once → documented outcome (merge, last write wins with a notice, or conflict prompt); no silent loss of the losing edit without a message
- [high · agent] Shared document: both type in the same paragraph, delete a region the other edits, undo and redo → documents converge to the same text on both sides; undo only undoes your own changes
- [medium · agent] Version or ETag checks: A saves a stale copy after B saved → refused with a conflict message, or merged; check with the HTTP client by sending an old version
- [medium · agent] Edit locks or "being edited by X" → lock appears, expires after inactivity, is released on close; admin can override as documented
- [medium · agent] Delete while another user edits the same item → the editor is told; no zombie save that recreates it
- [medium · agent] Reorder (drag and drop) the same list by two users → order ends the same for both; no duplicates or missing items

### Reconnection and recovery
- [high · agent] Drop the network for 5 seconds, 1 minute and 10 minutes, then restore → the client shows a connection status, reconnects with backoff, and catches up on missed events with no gaps or duplicates {smoke}
- [high · agent] Server restart or deploy while users are connected → clients reconnect without a manual reload; no thundering-herd storm (jittered backoff)
- [medium · agent] Reconnect with a stale last-event ID or cursor older than the server's buffer → falls back to a full refresh, not a silent gap
- [medium · agent] Edits typed while disconnected → queued and sent on reconnect, or blocked with a clear notice (see `offline-sync.md`)
- [medium · agent] Flapping network (up and down every few seconds) → no tight reconnect loop, no duplicate subscriptions, no memory growth
- [medium · agent] Fall back when WebSockets are blocked (proxy) → SSE or long polling works, or a clear message; behind a corporate proxy test with the transport forced off
- [medium · agent] Heartbeat and idle timeouts → idle connections stay alive through load balancers (ping/pong) and don't spin
- [medium · agent] Laptop sleep and wake, phone lock and unlock → connection restored; state refreshed

### Ordering and consistency
- [high · auto] Send events 1 to 100 quickly from one user → B receives them in order, exactly once each
- [medium · auto] Events from two users interleaved → every client ends with the same order (server timestamp or sequence, not client clocks)
- [medium · auto] Duplicate delivery of an event (retry, reconnect) → applied once (idempotent by event ID)
- [medium · auto] Out-of-order delivery of an update before its create → handled or buffered; no crash
- [medium · agent] Client clock far off (set the test machine's clock) → ordering and "x minutes ago" use server time
- [medium · agent] Optimistic UI: A's change shows at once, then the server rejects it → rolled back with a message; B never sees the rejected change
- [medium · agent] After a burst of changes the UI and a fresh page load show identical data

### Permissions changing mid-session
- [high · agent] Remove B from the workspace, revoke the role or delete the item while B is connected → B's updates stop; the next action is refused; B's UI says why {security}
- [high · auto] Subscribe to a channel or room by ID that B shouldn't join (another workspace, private chat) → refused at subscribe time; tested with a scripted client {security}
- [medium · agent] Sign out in one tab, or revoke the session → sockets close; the client doesn't keep receiving data {security}
- [medium · agent] Token expiry during a long connection → refreshed or re-authenticated without data loss; or the connection closes cleanly
- [medium · agent] Promote B to editor while the page is open → controls enable without a reload (or after the documented delay)

### Limits, scale and abuse
- [medium · auto] Message size and rate limits (large payloads, 100 messages per second from one client, locally) → rejected or throttled; the server stays up {security}
- [medium · auto] Malformed frames, invalid JSON, unknown event types, wrong auth on the socket → closed or ignored; no crash; no other users affected
- [medium · auto] Origin checks on the WebSocket handshake (cross-site WebSocket hijacking) → connections from other origins are refused {security}
- [medium · auto] Soak: 20 sessions for 30 minutes (local) → memory and connection counts stay flat; no growing lag
- [low · agent] Chat or comment content: long, emoji, links, HTML, mentions → escaped, ordered, scrolled to the bottom correctly; history loads on scroll up

### Interface
- [medium · agent] Connection status indicator (connected, reconnecting, offline) → visible and accurate; not alarming for short blips
- [medium · agent] Live updates for screen readers → polite live regions announce new messages without stealing focus; updates don't move the reading position {a11y}
- [low · agent] Reduced motion setting → live animations (cursor trails, flashes) are reduced {a11y}

## Gates

- Two-session smoke passes on every changed live feature.
- Reconnect after a drop catches up with no gaps or duplicates.
- Private events never reach unauthorized sessions; revoked users stop receiving data.
- Concurrent edits don't lose data silently.

## Human-only checks

- [human] Two real people on two real devices edit the same document for 10 minutes → does it feel fast and trustworthy; any surprises with cursors, undo or lost text?
- [human] Switch a real phone between Wi-Fi and cellular, lock it, and return → the app recovers without confusion
- [human] Judge latency on a real distant network or region → acceptable for the use

## Known pitfalls

- **Eventual consistency.** A short delay (about a second) before another session sees a change is normal; wait on the element before filing.
- **Dev server hot reload** drops sockets; restart the test session before judging reconnection.
- **Browsers throttle background tabs** (timers, sometimes sockets); an update arriving late in a hidden tab may be browser behavior.
- **Playwright contexts aren't tabs.** Cookies are separate per context; use one context for a same-user multi-tab test.
- **Presence timeouts** (30 to 60 seconds) explain "still online" after a hard close; compare to the stated timeout.
- **Echo of own events** is sometimes deliberate for confirmation; check the docs.
- **Free realtime tiers** (Supabase, Pusher) have message and connection limits; hitting them in tests isn't a product bug.
- Don't load-test shared or third-party realtime services.

## Sources

1. [MDN: WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) — connection lifecycle (checked 2026-11-16)
2. [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — `Last-Event-ID` and reconnection (checked 2026-11-16)
3. [RFC 6455: WebSocket protocol](https://www.rfc-editor.org/rfc/rfc6455) — origin, ping and pong, close codes (checked 2026-11-16)
4. [Playwright: WebSocket routing and offline](https://playwright.dev/docs/network) — `routeWebSocket`, `setOffline` (checked 2026-11-16)
5. [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) — origin checks, auth, limits (checked 2026-11-16)
6. [Yjs documentation](https://docs.yjs.dev/) — CRDT convergence and undo semantics (checked 2026-11-16)
