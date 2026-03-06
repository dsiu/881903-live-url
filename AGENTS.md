# AGENTS

Guidance for automated agents working in this repo.

## Stack
- Runtime: Bun
- Language: TypeScript (ESM)
- Browser automation: Playwright
- CLI entry: `./src/get-stream-url.ts`

## Commands

### Install
- `bun install`

### Run CLI
- Default channel (903): `bun run ./src/get-stream-url.ts`
- Channel 881: `bun run ./src/get-stream-url.ts --channel 881`
- JSON output: `bun run ./src/get-stream-url.ts --json`
- Play stream (ffplay): `bun run ./src/get-stream-url.ts --play`
- Help: `bun run ./src/get-stream-url.ts --help`

### Scripts (package.json)
- `bun run stream-url` (runs the CLI)

### Skills

Skills are installed via the OpenCode skill system. This repo uses a `skills-lock.json` file that records the installed skills and their source.

To install skills:

1. Run the skill installer (example):
   - `npx skills add vercel-labs/agent-browser --skill agent-browser`
2. Verify `skills-lock.json` is updated.

Notes:

- Installed skills are stored under `.agents/skills/`.
- Keep `skills-lock.json` committed so CI and teammates can reproduce the setup.

### Build / Lint / Test
- No build/lint/test scripts are configured.
- If adding tests, keep them runnable via Bun and document single-test usage here.

## Code Style

### Imports
- Use ESM `import` syntax.
- Keep imports at top of file.
- Prefer named imports from libraries (e.g., `import { chromium } from "playwright"`).

### Formatting
- 2-space indentation.
- Double quotes for strings.
- Trailing commas only when they aid readability (match existing style).

### Types
- Prefer explicit types for function parameters and return values when helpful.
- Keep types simple; avoid over-engineering for this small CLI.
- Use `Record<string, T>` for simple maps.

### Naming
- Use `camelCase` for functions/variables.
- Use `UPPER_SNAKE_CASE` for constants.
- Use clear, descriptive names (e.g., `extractM3u8Url`).

### Error Handling
- Fail fast with clear error messages via `fail()`.
- Use early returns to keep control flow simple.
- Use `try/finally` to ensure Playwright browser closes.

### CLI Behavior
- Defaults: channel 903 if `--channel` is not provided.
- Validate inputs and return a non-zero exit code on failure.
- Keep output minimal and machine-readable (`--json` mode).

### Networking / Playwright
- Use `waitForResponse` for `.m3u8` and `playlist.js` capture.
- If `.m3u8` not captured, fall back to parsing `playlist.js`.
- Always set `Referer` and `User-Agent` when requesting `playlist.js`.

### Streaming Playback
- Use `ffplay` only (VLC is unsupported in this repo).
- Pass `Referer` and `Cookie` headers to avoid 403 errors.

## Repo Notes
- Stream URLs are tokenized and expire; always fetch a fresh URL.
- Add new channels by extending `LIVE_URLS` and updating help text.

## Cursor / Copilot Rules
- None found in `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`.
