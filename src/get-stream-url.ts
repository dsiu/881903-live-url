#!/usr/bin/env bun
import { chromium } from "playwright";
import {
  DEFAULT_CHANNEL,
  extractLiveJsUrl,
  extractM3u8Url,
  LIVE_URLS,
  type Channel
} from "./stream-utils";

const buildCookieHeader = (cookies: Array<{ name: string; value: string }>) => {
  if (!cookies.length) {
    return "";
  }
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const isChannel = (value: string): value is Channel => value === "903" || value === "881";

const assertChannel = (value: string): Channel => {
  if (!isChannel(value)) {
    fail("--channel must be 903 or 881.");
  }
  return value as Channel;
};

const assertNonNull = <T>(value: T | null, message: string): T => {
  if (value === null) {
    fail(message);
  }
  return value as T;
};

const parseArgs = (argv: string[]) => {
  const args = new Set(argv);
  const getArgValue = (flag: string) => {
    const index = argv.indexOf(flag);
    if (index === -1 || index === argv.length - 1) {
      return null;
    }
    return argv[index + 1];
  };
  return {
    json: args.has("--json"),
    help: args.has("--help") || args.has("-h"),
    debug: args.has("--debug"),
    play: args.has("--play"),
    channel: getArgValue("--channel")
  };
};

const printHelp = () => {
  const message = [
    "Usage: 881903-live-url [--channel 903|881] [--json]",
    "",
    "Options:",
    "  --channel 903|881  Choose channel (default: 903)",
    "  --json   Output JSON { url: string }",
    "  --play   Play the stream URL via ffplay",
    "  --debug  Print playlist.js excerpt on failure",
    "  -h, --help  Show this help"
  ].join("\n");
  process.stdout.write(`${message}\n`);
};

const playStream = async (
  m3u8Url: string,
  page: import("playwright").Page,
  refererUrl: string
) => {
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const streamOrigin = new URL(m3u8Url).origin;
  const cookies = await page.context().cookies(streamOrigin);
  const cookieHeader = buildCookieHeader(cookies);
  const headers = [
    `Referer: ${refererUrl}`,
    cookieHeader ? `Cookie: ${cookieHeader}` : ""
  ].filter(Boolean).join("\r\n");
  const headerArg = headers ? `${headers}\r\n` : "";
  const proc = Bun.spawn({
    cmd: ["ffplay", "-user_agent", userAgent, "-headers", headerArg, m3u8Url],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });
  await proc.exited;
};

const main = async () => {
  const { json, help, debug, play, channel } = parseArgs(Bun.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  const selectedChannel = assertChannel(channel ?? DEFAULT_CHANNEL);
  const liveUrl = LIVE_URLS[selectedChannel];

  if (play && json) {
    fail("--play cannot be combined with --json.");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const playlistResponsePromise = page.waitForResponse(
      (response) => response.url().includes("playlist.js") && response.ok(),
      { timeout: 15000 }
    );
    const m3u8ResponsePromise = page.waitForResponse(
      (response) => response.url().includes(".m3u8") && response.ok(),
      { timeout: 15000 }
    );

    await page.goto(liveUrl, { waitUntil: "networkidle" });

    try {
      const m3u8Response = await m3u8ResponsePromise;
      const m3u8Url = m3u8Response.url();
      if (play) {
        await playStream(m3u8Url, page, liveUrl);
        return;
      }
      if (json) {
        process.stdout.write(`${JSON.stringify({ url: m3u8Url })}\n`);
      } else {
        process.stdout.write(`${m3u8Url}\n`);
      }
      return;
    } catch {
      // Fall back to playlist.js parsing below.
    }

    let playlistJs = "";
    try {
      const playlistResponse = await playlistResponsePromise;
      playlistJs = await playlistResponse.text();
    } catch {
      const html = await page.content();

      const liveJsUrl = assertNonNull(
        extractLiveJsUrl(html),
        "Failed to find liveJsUrl in page HTML."
      );

      const userAgent = await page.evaluate(() => navigator.userAgent);
      const response = await page.request.get(liveJsUrl, {
        headers: {
          Referer: liveUrl,
          Origin: "https://www.881903.com",
          "User-Agent": userAgent,
          "Sec-Fetch-Dest": "script",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "same-site"
        }
      });

      if (!response.ok()) {
        fail(`Failed to fetch playlist.js (${response.status()}).`);
      }

      playlistJs = await response.text();
    }

    const m3u8Url = assertNonNull(
      extractM3u8Url(playlistJs),
      "Failed to extract .m3u8 URL from playlist.js."
    );

    if (play) {
      await playStream(m3u8Url, page, liveUrl);
      return;
    }

    if (json) {
      process.stdout.write(`${JSON.stringify({ url: m3u8Url })}\n`);
    } else {
      process.stdout.write(`${m3u8Url}\n`);
    }
  } finally {
    if (browser.isConnected()) {
      await browser.close();
    }
  }
};

await main();
