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
        Accept: "*/*",
        Referer: liveUrl,
        Origin: "https://www.881903.com",
        "User-Agent": DEFAULT_USER_AGENT,
        "Sec-Fetch-Dest": "script",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9"
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
  console.log("[fetchPlaylistJs] Starting");
  const html = await page.content();
  const liveJsUrl = extractLiveJsUrl(html);

  if (!liveJsUrl) {
    console.error("[fetchPlaylistJs] Could not extract liveJsUrl from HTML. HTML length:", html.length);
    throw new Error("Failed to find liveJsUrl in page HTML.");
  }

  console.log("[fetchPlaylistJs] liveJsUrl:", liveJsUrl);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log("[fetchPlaylistJs] Fetching with User-Agent:", userAgent);

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

  console.log("[fetchPlaylistJs] Response status:", response.status());

  if (!response.ok()) {
    throw new Error(`Failed to fetch playlist.js (${response.status()}).`);
  }

  return response.text();
};

export const fetchStreamUrl = async (channel: Channel): Promise<StreamFetchResult> => {
  const liveUrl = LIVE_URLS[channel];
  console.log("[fetchStreamUrl] Starting for channel", channel, "url:", liveUrl);

  const browser = await launchChromium();
  console.log("[fetchStreamUrl] Browser launched");

  const page = await browser.newPage();
  console.log("[fetchStreamUrl] Page created");

  try {
    const playlistResponsePromise = page.waitForResponse(
      (response) => response.url().includes("playlist.js") && response.ok(),
      { timeout: 15000 }
    );
    const m3u8ResponsePromise = page.waitForResponse(
      (response) => response.url().includes(".m3u8") && response.ok(),
      { timeout: 15000 }
    );

    console.log("[fetchStreamUrl] Navigating to", liveUrl);
    await page.goto(liveUrl, { waitUntil: "networkidle" });
    console.log("[fetchStreamUrl] Navigation complete");

    try {
      const m3u8Response = await m3u8ResponsePromise;
      console.log("[fetchStreamUrl] Got m3u8 response");
      return {
        url: m3u8Response.url(),
        fetchedAtMs: Date.now()
      };
    } catch (e) {
      console.log("[fetchStreamUrl] m3u8 response timeout, falling back");
    }

    let playlistJs: string | null = null;

    try {
      const playlistResponse = await playlistResponsePromise;
      console.log("[fetchStreamUrl] Got playlist response");
      playlistJs = await playlistResponse.text();
    } catch (e) {
      console.log("[fetchStreamUrl] Playlist response timeout, fetching directly");
      playlistJs = await fetchPlaylistJs(page, liveUrl);
    }

    const m3u8Url = extractM3u8Url(playlistJs);
    if (!m3u8Url) {
      throw new Error("Failed to extract .m3u8 URL from playlist.js.");
    }

    console.log("[fetchStreamUrl] Success!");
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
