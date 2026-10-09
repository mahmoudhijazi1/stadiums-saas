# Push notifications (web push)

**Living.** Slice A (2026-10-11): an owner can turn notifications on for a phone and send themselves a test. Slice B (branch `feat/push-new-request`): a player's new request alerts the people who can approve it. Other alert kinds are not built yet (see [ROADMAP.md](./ROADMAP.md)). Nothing in `booking` sends or imports anything from push.

Code: `src/modules/push/`, `public/sw.js`, `src/app/owner/(app)/more/notifications/`. Journey and decisions: the three "Push notifications, commit N of 4" entries in [progress.md](./progress.md).

## The idea in one minute

A normal web page can only talk to you while it is open. **Web push** lets our server wake the phone's browser even when the app is closed, through a free service run by the browser's maker (Google for Chrome, Apple for Safari, Mozilla for Firefox). We never talk to the phone directly. We hand an encrypted message to that service, and it delivers it.

```
 PHONE (browser)                         OUR SERVER                      PUSH SERVICE (Google / Apple / Mozilla)
 ───────────────                         ──────────                      ───────────────────────────────────────
 1. Owner taps "Enable notifications".
    The browser asks permission, then makes a
    subscription: { endpoint, p256dh, auth }.
 2. submitSubscribePush ───────────────► checks endpoint + keys, stores a PushSubscription row
                                          (tied to the login session).
 3.                                       sendTestPush: builds a small JSON payload, encrypts it with
                                          the row's keys, signs it with our VAPID private key, and
                                          POSTs it to the endpoint ───────────────────────────────────► keeps it until the phone is reachable
 4. The service worker (public/sw.js) wakes up  ◄──────────────────────────────────────────────────────  delivers it
    and runs its "push" handler: showNotification().
 5. Owner taps the notification. The "notificationclick" handler focuses the app (or opens it) at a
    path under /owner/.
```

Every layer has one job: the **domain** functions decide what is allowed and what the message says (pure, unit-tested), the **application** use cases authorize and orchestrate, the **infrastructure** talks to Postgres and to the `web-push` library, and the **service worker** shows the notification.

## The new-request alert (slice B)

```
 PLAYER                         app/(public)/request-slot.ts                       OWNER'S PHONE
 ──────                         ───────────────────────────                       ─────────────
 submits the public form ─────► requestPublicSlot(...)  (its own transaction, commits)
                                 │  created a PENDING request?  (a taken hour throws instead)
                                 ├─ after(alertOwnersOfNewRequest)   ← scheduled, not awaited
 ◄──── redirect ?ok=requested ───┘
                                 (the response is already gone; now, in the background:)
                                 alertOwnersOfNewRequest:
                                   countPendingForAlert()  → N waiting (the badge's rule)
                                   notifyNewRequest({ N })
                                     members with bookings.approve → their devices here
                                     per device: one alert per 120 s? send (5 at a time, 5 s cap) ─► push ─► "New booking request"
```

**Where it is composed.** `booking` must not import `push`, so the two meet in `app/(public)/alert-owners.ts`, which only the public request action calls. The alert runs inside `after()` (`next/server`, available in the installed Next), which runs once the response is sent. It is never inside the request's transaction, never awaited by the action, and never throws: an error is logged by name only and the player's result does not change. An owner-created booking and the "slot taken" branch (which records an interest, not a pending request) never reach it.

**Who receives it, and why.** The members of this stadium for whom `can(membership, "bookings.approve")` is true: the owner, and staff who were granted that flag. Staff without it can see the requests list but cannot act on a request (BR-97), so a buzz that sends them to a screen where they can do nothing is noise. Every device each recipient has registered in this stadium gets it. Another stadium's members and devices never do: the queries go through the tenant-scoped client.

**What it says.** Generic, in the language each device registered with: the stadium name as the title; "New booking request" for one, "N requests waiting" for more (Arabic: "طلب حجز جديد", "N طلبات بانتظارك"). No player name, no phone: a lock screen is public. Tapping it opens `/owner/requests`. Tag `new-requests` with `renotify`, so a new alert replaces the one still on screen and buzzes again; the same string is the push topic, so a message still waiting at the push service is replaced too. TTL is one hour: after that the request is old news.

**The throttle, and why a skipped alert is not queued.** A device gets at most one new-request alert per 120 seconds (a `RateLimit` row keyed `pushalert:<subscriptionId>`; the window starts at the first alert). A request that arrives inside the window sends nothing to that device. We do not queue it because (1) the badge and the Requests list already show it the moment the owner opens the app, (2) a queue needs a scheduler we do not have, and (3) the next alert after the window carries the full count ("3 requests waiting"), so nothing is lost, only merged. The throttle is per device, so a second phone is not silenced by the first. This also limits what a flood of fake requests can do to an owner's phone (the public form has its own limits too).

**Sending safely.** Sends run five at a time and each is cut off after 5 seconds, so one slow or dead push service cannot hold up the others or the background task. One device failing (an exception, a timeout, a 500) is counted and the rest continue. A 404 or 410 deletes that device's row. Anything else keeps it. The log line has counts only (`devices`, `sent`, `skipped`, `removed`, `failed`), never a name, phone, endpoint or key. With no VAPID keys (development), a suspended stadium, nothing waiting, or no subscribers, it does nothing and does not error.

## Glossary

| Word | Meaning |
|---|---|
| **Subscription** | What the browser gives us for one device: an endpoint and two keys. One row in `PushSubscription`. |
| **Endpoint** | A long https URL at the push service. Whoever knows it can ask the service to deliver a message to that browser (still encrypted, so only that browser can read it). Treat it like a password: we never log the path, only the host. |
| **p256dh** | The browser's public key (a point on the P-256 curve, 65 bytes, 87 base64url characters). We encrypt the payload with it. |
| **auth** | A 16-byte secret (22 characters) the browser shares with us. It is mixed into the encryption. |
| **VAPID** | "Voluntary Application Server Identification". Our own key pair. Every push is signed with the **private** key; the browser's subscription is tied to our **public** key, so nobody else can push to our subscriptions. The `VAPID_SUBJECT` (a `mailto:` or https URL) tells the push service who to contact if we misbehave. |
| **TTL** | Time to live: how long the push service keeps the message if the phone is off. A TEST uses 60 seconds; after that it is dropped, because an old test is noise. |
| **Topic** | A short label. A newer message with the same topic replaces one still waiting at the push service. We use the payload's `tag`. |
| **Urgency** | `high` asks the service to deliver now (TEST uses it). |
| **Tag / renotify** | On the phone, a notification with the same tag replaces the earlier one instead of stacking; `renotify` makes it buzz again. |
| **userVisibleOnly** | A promise to the browser that every push will show a notification. This is why the worker's push handler **always** calls `showNotification`, even for an empty payload. Browsers may cancel a subscription that breaks the promise. |

## Why the endpoint allowlist exists (SSRF)

When we send, **our server** makes an HTTP POST to the endpoint string the browser gave us. If we stored any string, an attacker could "subscribe" with `http://169.254.169.254/...` (a cloud metadata address) or an internal service, and our server would call it on their behalf. That attack is called SSRF (server-side request forgery).

So `validatePushEndpoint` (`src/modules/push/domain/push-endpoint.ts`) accepts only: https, no user:password, no explicit port, at most 2048 characters, and a host that is **exactly** one of the vendor hosts or ends with `.` plus a vendor suffix (the dot matters: `evilnotify.windows.com` is refused; `fcm.googleapis.com.evil.com` is refused). IP addresses and `localhost` are refused. The list lives in ONE constant, `PUSH_ENDPOINT_HOSTS`. Only `fcm.googleapis.com` is confirmed by the web-push documentation; the Mozilla, Apple and Windows hosts are marked **UNVERIFIED** in the code. If a real browser is refused, the log line "Push subscribe refused" is the clue; add its host to the constant with a test.

## How clean-up works (the cascade)

Each `PushSubscription` row points at the login `Session` that created it, with `ON DELETE CASCADE`. When the session row disappears, the database deletes the device with it. No push code runs, so there is nothing to forget:

| Event | What deletes the session |
|---|---|
| Log out | `logout` → `deleteSessionByToken` |
| Log out other devices | `logOutOtherDevices` → `deleteOtherSessions` |
| Change password | `replacePasswordKeepingSession` (all other sessions) |
| Login clean-up of expired sessions | `deleteExpiredSessions` |

Two more clean-ups happen in the push code: a `gone` answer (HTTP 404 or 410 from the push service: the browser unsubscribed or the subscription expired) deletes that row at send time; and "Turn off" in the sheet deletes the row and unsubscribes the browser. A suspended stadium keeps its rows (suspension does not touch sessions) but no one can send or subscribe, because the tenant choke point refuses.

A re-login on the same phone creates a **new** session, so the old row is gone but the browser still holds its subscription. That is why the Notifications sheet, when permission is already granted, re-sends the subscription once per browser session. The server does an upsert by endpoint: it is taken over by the current user, session and tenant. At most 10 devices are kept per user in a stadium (the least recently synced are dropped).

## VAPID keys

Generate one pair **per environment** (local, staging, production), once:

```
npx web-push generate-vapid-keys
```

Put them in the server's `.env` as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT="mailto:you@example.com"` (see [RUNBOOK.md](./RUNBOOK.md) "Push keys"). **Never commit them, never log them, never paste the private key into a ticket or chat.** In production the server refuses to start without all three. Locally they are optional: without them the feature reports "not configured" and the Notifications row is hidden.

**If the keys change** (you regenerate them, or production gets a different pair): every existing subscription was made with the old public key and can no longer be sent to; the push service answers with an authorization error (usually 401 or 403; UNVERIFIED, not seen against a real push service), which we treat as `retry`, so the rows stay. The owner fixes it by opening More → Notifications: the sheet notices that the browser's subscription uses a different key, drops it, and makes a new one when they tap Enable. Plan a key change as "everyone taps Enable again". Do not rotate casually.

## iOS (iPhone and iPad)

Web push on iOS works only for a web app **added to the Home Screen** (iOS 16.4 or later), opened from that icon. In a normal Safari tab there is no push API at all. So the sheet, on an iPhone that has not installed the app, says: Share → Add to Home Screen, then open it from there. The permission prompt must also come from a direct tap, which is why the Enable button calls `Notification.requestPermission()` as the very first thing in its handler. Do Not Disturb and Focus modes silence notifications on the phone; that is not a bug.

## Debugging checklist

1. **Is it configured?** If the Notifications row is missing in More, the server has no VAPID keys (`getPushPublicKey()` returned null).
2. **Chrome DevTools → Application → Service Workers**: is `/sw.js` activated with scope `/owner/`? "Update on reload" helps while editing it. Click **Push** there to fire a fake push at the worker without the server (this tests the worker alone).
3. **Application → Storage / Notifications**: is permission "Allow" for the site? (Padlock in the address bar.)
4. **The subscription row**: `SELECT "userId","tenantId","locale","createdAt", left("endpoint", 40) FROM "PushSubscription" ORDER BY "createdAt" DESC;`. No row for the device means subscribe never reached the server (look for the error in the sheet and for "Push subscribe refused" in the log). Never paste a full endpoint or the keys into a ticket.
5. **Server logs** (`logs/<day>.log`): `Push test ok host=…` (the push service accepted it), `Push test gone host=… status=410` (row deleted), `Push test retry host=… status=…` (service refused or was down; 401/403 usually means wrong VAPID keys, 413 an oversized payload, 429 too many).
6. **Accepted but nothing on the phone**: the service accepted the message, so the problem is on the device: notifications blocked for the browser in the phone's settings, battery saver, a Focus mode, or (iOS) the app is not installed.
7. **Rate limit**: the test button allows 5 per 10 minutes per user (`RateLimit` key `pushtest:<userId>`).
8. **Local development**: push needs a secure context. `localhost` counts; a custom host such as `ahmad.localhost` may not on every browser. `next dev --experimental-https` is the documented route (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`).

## Tests

- Pure domain and the worker run in plain Jest: `test/modules/push/*.test.ts`. The worker test (`service-worker.test.ts`) loads `public/sw.js` into a Node `vm` with a fake `self`, `caches` and `clients`; it proves what the worker does with a push or a click, not that a real browser delivers one.
- `test/integration/push.integration.test.ts` runs against Postgres with a fake `PushSender` (`test/modules/push/fake-push-sender.ts`): upsert and take-over, the cap, isolation between stadiums, the session cascade, 404/410/500, the rate limit.
- `test/modules/push/imports.test.ts` pins the rules: `web-push` is imported by one server file, the private key is read by one file, and `booking` never imports `push`.

## Checks to run by hand for the new-request alert (slice B)

Two phones, both logged in as people who may approve (for example the owner on an Android phone and a staff member with "approve" on an iPhone, or the owner on both), each with notifications enabled (slice A checks 1 to 9). A third device or a private window plays the player at the public page.

1. **Basic.** With both phones' apps closed, submit a request from the public page. Both phones buzz within a few seconds: the stadium name and "New booking request" (Arabic or English by the phone's language). The player sees the normal "request sent" page at the normal speed.
2. **Tap.** Tap the notification: the app opens at Requests, with the new request at the top.
3. **Throttle.** Submit a second request within two minutes: no new notification on either phone, but the badge and the Requests list show 2.
4. **Merge.** Wait more than two minutes and submit a third: one notification, "3 requests waiting".
5. **Replace.** Leave an alert unread on the lock screen, wait two minutes, submit another: the old one is replaced, not stacked.
6. **Who.** Give a staff member no "approve" permission: they get nothing. Give it: they get it.
7. **Other stadium.** With a phone enabled in another stadium, a request here does not reach it.
8. **Not a request.** Create a booking by hand as the owner, and fill an hour that is taken from the public page: no notification in either case.
9. **Privacy.** Read the lock screen text: no player name or phone. Check `logs/<day>.log`: `New-request alert devices=… sent=… skipped=…` lines, no names or numbers.
10. **Dead device.** Uninstall the app on one phone, submit a request twice with more than two minutes between: the second time the dead device's row is gone from `PushSubscription` and the other phone is unaffected.
11. **Suspended.** Suspend the stadium: the public page is unavailable and no alert is sent.

## Checks to run by hand (needs a real phone)

The code cannot prove delivery; these checks do. Use two devices, ideally an Android phone with Chrome and an iPhone. Use a stadium on a real HTTPS host with VAPID keys set.

**Android (Chrome), browser tab and installed**
1. Log in as an owner, More → Notifications. The row exists. The sheet offers **Enable notifications**.
2. Tap it: the browser asks for permission **only now**. Allow. The sheet shows the "on for this device" line and **Send a test notification**.
3. Tap Send a test: within a few seconds a notification appears with the stadium name, the generic text, and the app icon. Close the app fully (swipe it away) and send another: it still arrives. Tap it: the app opens at More.
4. With the app open, send a test again: you still see the notification (the worker always shows one).
5. Send 6 tests quickly: the 6th shows "Too many tries".
6. Turn off: the status returns to "Enable". A test now says no device is turned on. Enable again.
7. Block notifications for the site in the phone's settings, reopen the sheet: it shows the "blocked, re-enable in settings" text and no button.

**iPhone**
8. In Safari (not installed), open More → Notifications: it says to Add to Home Screen first. No permission prompt appears.
9. Add to Home Screen, open from the icon, log in. Enable → prompt → Allow. Send a test: it arrives on the lock screen. Tap it: the installed app opens.

**Two users and two stadiums**
10. Log in as the owner on device A and staff on device B (same stadium). Send a test from A: only A receives it.
11. On one phone, log out, log in as the other user, open the sheet: it shows "on" and a test reaches this phone as the new user (the device was taken over). The first user's device list no longer has it.
12. Log in on a second phone with the same account, then on the first phone use More → Account → Log out other devices. The second phone stops receiving tests; the first still does.
13. Change the password from the first phone: the same result for every other session.
14. If you have two stadiums on one phone (two subdomains), enable in each: a test in one reaches only that stadium's subscription.
15. Suspend a stadium with the platform CLI: the sheet's actions are refused there; resume it and they work again.

**Look at the data**
16. In `PushSubscription`, check one row per enabled device, with the right `tenantId`, and that after step 12 the other session's row is gone.
17. In the log, find `Push test ok host=…` lines. Confirm no line contains an endpoint path, a key, or a name.
