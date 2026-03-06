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

## TypeScript linting

Type-check the project:

```bash
bun run lint:ts
```
