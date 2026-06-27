import { chromium } from "playwright-core";
import { extractLiveJsUrl, extractM3u8Url, LIVE_URLS, type Channel } from "./stream-utils.js";

export type StreamFetchResult = {
  url: string;
  fetchedAtMs: number;
};

// Serialize browser launches so concurrent invocations don't race on the
// shared @sparticuz/chromium binary extraction in /tmp (causes spawn ETXTBSY).
let launchLock: Promise<unknown> = Promise.resolve();

const launchSerialized = async <T>(fn: () => Promise<T>): Promise<T> => {
  const run = launchLock.then(fn, fn);
  launchLock = run.catch(() => {});
  return run;
};

const launchVercelChromium = async () => {
  const { default: sparticuz } = await import("@sparticuz/chromium");
  const executablePath = await sparticuz.executablePath();

  // Retry on ETXTBSY: the binary may still be flushing to disk on cold start.
  for (let attempt = 0; ; attempt++) {
    try {
      return await chromium.launch({
        args: sparticuz.args,
        executablePath,
        headless: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < 3 && message.includes("ETXTBSY")) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
};

const getBrowser = async () => {
  const wsEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
  if (wsEndpoint) {
    return chromium.connect(wsEndpoint);
  }

  // On Vercel (serverless), use the bundled @sparticuz/chromium binary.
  if (process.env.VERCEL) {
    return launchSerialized(launchVercelChromium);
  }

  // Local / CLI: rely on the system-installed Playwright Chromium.
  return chromium.launch({ headless: true });
};

const fetchPlaylistJs = async (page: import("playwright-core").Page, liveUrl: string) => {
  const html = await page.content();
  const liveJsUrl = extractLiveJsUrl(html);

  if (!liveJsUrl) {
    console.error("[fetchPlaylistJs] Failed to extract liveJsUrl. HTML length:", html.length);
    console.error("[fetchPlaylistJs] HTML snippet:", html.substring(0, 500));
    throw new Error("Failed to find liveJsUrl in page HTML.");
  }

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
    throw new Error(`Failed to fetch playlist.js (${response.status()}).`);
  }

  return response.text();
};

export const fetchStreamUrl = async (channel: Channel): Promise<StreamFetchResult> => {
  const liveUrl = LIVE_URLS[channel];
  console.log("[fetchStreamUrl] Starting for channel", channel, "URL:", liveUrl);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const playlistResponsePromise = page.waitForResponse(
      (response) => response.url().includes("playlist.js") && response.ok(),
      { timeout: 30000 }
    );
    const m3u8ResponsePromise = page.waitForResponse(
      (response) => response.url().includes(".m3u8") && response.ok(),
      { timeout: 30000 }
    );

    await page.goto(liveUrl, { waitUntil: "domcontentloaded" });

    try {
      const m3u8Response = await m3u8ResponsePromise;
      return {
        url: m3u8Response.url(),
        fetchedAtMs: Date.now()
      };
    } catch {
      // Fall back to playlist.js parsing below.
    }

    let playlistJs = "";
    try {
      const playlistResponse = await playlistResponsePromise;
      playlistJs = await playlistResponse.text();
    } catch {
      playlistJs = await fetchPlaylistJs(page, liveUrl);
    }

    const m3u8Url = extractM3u8Url(playlistJs);
    if (!m3u8Url) {
      throw new Error("Failed to extract .m3u8 URL from playlist.js.");
    }

    return {
      url: m3u8Url,
      fetchedAtMs: Date.now()
    };
  } finally {
    await browser.close();
  }
};
