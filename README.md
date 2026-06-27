# 881903 Live URL

Fetch the current 881903 live stream `.m3u8` URL or play it directly. Includes a small web server for sharing `/live/*` endpoints.

## Requirements

- Bun
- ffplay (for `--play`)

## Install

```bash
bun install
```

## CLI Usage

Plain URL:

```bash
bun run ./src/get-stream-url.ts
```

JSON output:

```bash
bun run ./src/get-stream-url.ts --json
```

Play stream (ffplay):

```bash
bun run ./src/get-stream-url.ts --play
```

Help:

```bash
bun run ./src/get-stream-url.ts --help
```

## Server (local)

Start the server:

```bash
bun run server
```

Endpoints:

- `GET /` Home page that fetches current stream URLs.
- `GET /live/903` Redirects to the current `.m3u8` for channel 903.
- `GET /live/881` Redirects to the current `.m3u8` for channel 881.
- `GET /live/903?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.
- `GET /live/881?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.

Caching:

- Stream URLs are cached for 10 minutes in-memory.

## Vercel

This project includes a Vercel-ready serverless function under `api/`.

Vercel endpoints:

- `GET /` Home page (rewritten to `/api`).
- `GET /live/903` Redirects to the current `.m3u8` for channel 903.
- `GET /live/881` Redirects to the current `.m3u8` for channel 881.
- `GET /live/903?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.
- `GET /live/881?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.

Direct API endpoints:

- `GET /api` Home page.
- `GET /api/live/903` Redirects to the current `.m3u8` for channel 903.
- `GET /api/live/881` Redirects to the current `.m3u8` for channel 881.
- `GET /api/live/903?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.
- `GET /api/live/881?format=json` Returns JSON `{ channel, url, cached, fetchedAtMs, expiresAtMs }`.

Notes:

- Uses `playwright-core` + `@sparticuz/chromium` for Vercel serverless compatibility.
- `vercel.json` sets `maxDuration` to 60s to reduce timeouts.

## Project Status & Key Findings

_Last investigated: 2026-06-27. Read this first when resuming._

### TL;DR
- **Local CLI: works fully.** Fetcher and player are the same machine/IP, so the IP-bound stream token is valid.
- **Vercel deployment: mechanically healthy but cannot serve a playable URL to remote users.** The stream URL it returns only works from Vercel's own IP (proven below).
- **The only way to give a remote mobile/desktop browser a playable URL is a stream proxy on a stable-IP host** (e.g. Fly.io). Pure client-side (browser-only) is blocked by the site's hardening.

### THE core finding: stream tokens are IP-bound (proven)
The `.m3u8` URL carries a token `?...&t=<unixts>.1.<signature>`. That token is cryptographically bound to the **IP address that fetched it**.

Verified with a controlled cross-IP probe (a temporary `?probe=<url>` endpoint, since removed):

| Token captured by | Fetched from local Mac | Fetched from Vercel (HK) |
|---|---|---|
| Local Mac | ✅ 200 | ❌ 403 |
| Vercel (HK) | ❌ 403 | ✅ 200 |

Same URL, fetched seconds apart (no expiry involved). The only variable that flips 200↔403 is the requester's IP. Cookies are **not** required (same-IP fetches with no cookies return 200). This is anti-hotlinking by design.

**Implication:** the "fetch a URL server-side, hand it to the client" model is impossible for this site. Whoever fetches the URL is the only IP that can play it.

### Why pure client-side (mobile browser only) is also impossible
Idea: have the user's *own browser* mint the token (then fetcher = player = user's IP). Blocked by three independent walls on `881903.com`, all measured:

| Wall | Measurement | Effect |
|---|---|---|
| `playlist.js` is **Referer-gated** | `Referer: https://www.881903.com` → 200; empty / Google / any other origin → **403** | Your page can only send Referer = your own origin (or empty). Browsers **cannot forge** a cross-origin Referer, so your page can never fetch the token-minting script. |
| `.m3u8`/chunks **CORS-locked** | `Access-Control-Allow-Origin: https://www.881903.com` | `hls.js` (needed on Android/Chrome) uses `fetch` → blocked from your origin. (iOS native `<video>`/`<audio>` could bypass CORS, but still needs the URL, which is gated above.) |
| Live page **`X-Frame-Options: DENY`** | header present | Cannot embed their player in an `<iframe>` either. |

`playlist.js` is also `eval(atob(...))`-obfuscated, so extraction is fragile even if fetchable.

The blocker is the browser **same-origin / Referer security model**, not IP. It would only be possible via a native app / custom WebView (can set the Referer header) or a browser extension/userscript (elevated privileges; thin support on mobile).

### Stream mechanics (for reference)
- Page: `https://www.881903.com/live/{903,881}` → contains `liveJsUrl`.
- `liveJsUrl`: `https://playlist.881903.com/web/v4/{903,881}hd/playlist.js?t=&n1=&n2=&z=` (obfuscated; mints the m3u8 URL, bound to the fetcher IP; Referer-gated).
- Master playlist: `https://<edge>.881903.com/edge-ts/{903,881}hd/playlist.m3u8?r=&ri=&t=<token>` → references `chunks.m3u8?sessionId=...`.
- Stream is **64 kbps audio** (`CODECS="mp4a.40.2"`), so proxy bandwidth is trivial (~29 MB per listener-hour).
- **Geo matters:** from a US IP the site serves a tokenless `edge-aac` URL (needs CloudFront `Key-Pair-Id` cookies, not playable standalone); from Hong Kong it serves the `edge-ts` URL with the `t=` token. Always fetch from an **Asia/HK** region.

### The viable solution (not yet built): stable-IP proxy
Deploy to a host with a **stable IP** (Fly.io / Railway / Render / VPS) in the **`hkg` region**:
- One process bootstraps the session via browser and proxies the HLS (playlist + chunks, rewriting URLs) from that same IP.
- Serve a small player page from your own origin so you control CORS → `hls.js` works on Android, native HLS on iOS. The listener only ever touches your domain.
- This is the only no-install, any-mobile-browser path.
- **Why not Vercel:** Vercel egress IP is not stable across invocations (browser-bootstrap invocation vs each chunk-proxy invocation can differ) → segment fetches would 403. A stable single IP is required.
- **Fly.io cost estimate (2026-06-27):** no free tier, credit card required, pay-as-you-go, no minimum. `shared-cpu-1x` 512 MB = $3.19/mo (1 GB = $5.70/mo) if 24/7; with auto-stop/start it tracks usage (~$1/mo for personal use). HK egress $0.04/GB → ~0.12¢ per listener-hour (bandwidth is rounding error). Inbound is free.

### Fixes applied this session (already committed on branch `vercel-chromium-fixes`, PR #2)
- **`networkidle` → `domcontentloaded`** in `get-stream-url.ts` and `stream-service.ts`. A live-stream page never goes network-idle, so `waitUntil: "networkidle"` always hit the 30s `goto` timeout — this was the root cause of both the CLI breakage and the "Vercel timeouts."
- **`@sparticuz/chromium` on Vercel:** `getBrowser()` in `stream-service.ts` branches — `BROWSERLESS_WS_ENDPOINT` → CDP connect; `process.env.VERCEL` → sparticuz launch; else local Playwright Chromium.
- **`ETXTBSY` concurrency fix:** concurrent invocations raced on the shared `/tmp/chromium` extraction. Added a module-level serialized launch + retry-on-`ETXTBSY`.
- **`hkg1` region pin** in `vercel.json` (see geo note above).
- **Hobby-plan limits:** function memory capped at 2048 MB (was 3008); Bun server needs `idleTimeout: 60`; fetch timeouts bumped (`waitForResponse` 30s, API `withTimeout` 45s) to fit the 60s function budget.

### Tried and abandoned
- **Browserless.io** (remote browser over WebSocket): HTTP `/json/version` was reachable, but every WebSocket `connect` attempt timed out at the handshake. Abandoned in favor of `@sparticuz/chromium`. (`getBrowser()` still honors `BROWSERLESS_WS_ENDPOINT` if ever set.)

## TypeScript linting

Type-check the project:

```bash
bun run lint:ts
```
