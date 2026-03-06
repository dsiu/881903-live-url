# AGENTS

Guidance for automated agents working in this repo.

## Stack
- Runtime: Bun
- Language: TypeScript (ESM)
- Browser automation: Playwright (CLI uses full `playwright`; server uses `playwright-core` + `@sparticuz/chromium` for Vercel)
- CLI entry: `./src/get-stream-url.ts`
- Server entry (local): `./src/server.ts`
- Serverless entry (Vercel): `./api/index.ts`

## Commands

### Install
- `bun install`

### Run CLI
- Default channel (903): `bun run ./src/get-stream-url.ts`
- Channel 881: `bun run ./src/get-stream-url.ts --channel 881`
- JSON output: `bun run ./src/get-stream-url.ts --json`
- Play stream (ffplay): `bun run ./src/get-stream-url.ts --play`
- Help: `bun run ./src/get-stream-url.ts --help`

### Run Server
- Local dev server: `bun run server`

### Lint / Typecheck
- TypeScript lint (typecheck): `bun run lint:ts`

### Tests
- No test suite is configured.
- If you add tests, also add a single-test command here.

## Agents and Skills

This repo uses OpenCode agents and skills for automation.

- Skills are installed under `.agents/skills/` and tracked in `skills-lock.json`.
- Keep `skills-lock.json` committed; do not commit `.agents/`.

To install skills (example):

1. Run:
   - `npx skills add vercel-labs/agent-browser --skill agent-browser`
2. Verify `skills-lock.json` is updated.

## Code Style

### Imports
- Use ESM `import` syntax.
- Keep imports at top of file.
- Prefer named imports from libraries (e.g., `import { chromium } from "playwright"`).
- Type-only imports should use `import type`.

### Formatting
- 2-space indentation.
- Double quotes for strings.
- Use template literals only when interpolation is needed.
- Trailing commas only when they aid readability (match existing style).

### Types
- Prefer explicit types for function parameters and return values when helpful.
- Keep types simple; avoid over-engineering for this small codebase.
- Use `Record<string, T>` for simple maps.

### Naming
- `camelCase` for functions/variables.
- `UPPER_SNAKE_CASE` for constants.
- Use clear, descriptive names (e.g., `extractM3u8Url`).

### Error Handling
- Fail fast with clear error messages via `fail()` in CLI code.
- Use early returns to keep control flow simple.
- Use `try/finally` to ensure Playwright browser closes.
- For server handlers, return JSON errors with status 500.

### CLI Behavior
- Default channel is 903 if `--channel` is not provided.
- Validate inputs and exit non-zero on failure.
- Keep output minimal and machine-readable (`--json` mode).

### Networking / Playwright
- Prefer `waitForResponse` to capture `.m3u8` and `playlist.js`.
- If `.m3u8` is not captured, fall back to parsing `playlist.js`.
- Always set `Referer` and `User-Agent` when requesting `playlist.js`.

### Streaming Playback
- Use `ffplay` only (VLC unsupported).
- Pass `Referer` and `Cookie` headers to avoid 403 errors.

### Caching
- Server caches stream URLs for 10 minutes.
- Avoid spawning multiple browsers by honoring the inflight cache.

## Repo Notes
- Stream URLs are tokenized and expire; always fetch a fresh URL when cache is stale.
- Add new channels by extending `LIVE_URLS` and updating help text.

## Cursor / Copilot Rules
- None found in `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`.
