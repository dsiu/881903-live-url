import { launchChromium } from "./browser.js";
import { extractLiveJsUrl, extractM3u8Url, LIVE_URLS, type Channel } from "./stream-utils.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const isVercelRuntime = () => Boolean(process.env.VERCEL || process.env.AWS_REGION);

const fetchStreamUrlViaHttp = async (channel: Channel): Promise<StreamFetchResult> => {
  const liveUrl = LIVE_URLS[channel];

  try {
    const liveResponse = await fetch(liveUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT
      }
    });

    if (!liveResponse.ok) {
      throw new Error(`Failed to fetch live page (${liveResponse.status}).`);
    }

    const html = await liveResponse.text();
    const liveJsUrl = extractLiveJsUrl(html);
    if (!liveJsUrl) {
      console.error("HTML excerpt:", html.substring(0, 500));
      throw new Error("Failed to find liveJsUrl in page HTML.");
    }

    const playlistResponse = await fetch(liveJsUrl, {
      headers: {
        Referer: liveUrl,
        Origin: "https://www.881903.com",
        "User-Agent": DEFAULT_USER_AGENT
      }
    });

    if (!playlistResponse.ok) {
      throw new Error(`Failed to fetch playlist.js (${playlistResponse.status}).`);
    }

    const playlistJs = await playlistResponse.text();
    const m3u8Url = extractM3u8Url(playlistJs);
    if (!m3u8Url) {
      console.error("Playlist excerpt:", playlistJs.substring(0, 500));
      throw new Error("Failed to extract .m3u8 URL from playlist.js.");
    }

    return {
      url: m3u8Url,
      fetchedAtMs: Date.now()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fetchStreamUrlViaHttp] ${message}`);
    throw error;
  }
};

export type StreamFetchResult = {
  url: string;
  fetchedAtMs: number;
};

const fetchPlaylistJs = async (page: import("playwright-core").Page, liveUrl: string) => {
  const html = await page.content();
  const liveJsUrl = extractLiveJsUrl(html);

  if (!liveJsUrl) {
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
  const isVercel = isVercelRuntime();
  console.log("[fetchStreamUrl] isVercel:", isVercel, "VERCEL env:", process.env.VERCEL, "AWS_REGION env:", process.env.AWS_REGION);

  if (isVercel) {
    console.log("[fetchStreamUrl] Using HTTP fetch for Vercel runtime");
    return fetchStreamUrlViaHttp(channel);
  }

  console.log("[fetchStreamUrl] Using browser automation");
  const liveUrl = LIVE_URLS[channel];
  const browser = await launchChromium();
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
      return {
        url: m3u8Response.url(),
        fetchedAtMs: Date.now()
      };
    } catch {
      // Fall back to playlist.js parsing below.
    }

    let playlistJs: string | null = null;

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
    if (browser.isConnected()) {
      await browser.close();
    }
  }
};
