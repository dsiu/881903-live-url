import { launchChromium } from "./browser.js";
import { extractLiveJsUrl, extractM3u8Url, LIVE_URLS, type Channel } from "./stream-utils.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

const isVercelRuntime = () => {
  const detected = !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_URL ||
    process.env.AWS_REGION
  );
  console.log("[isVercelRuntime] VERCEL:", process.env.VERCEL, "VERCEL_URL:", process.env.VERCEL_URL, "detected:", detected);
  return detected;
};

const fetchStreamUrlViaHttp = async (channel: Channel): Promise<StreamFetchResult> => {
  const liveUrl = LIVE_URLS[channel];
  console.log("[fetchStreamUrlViaHttp] Fetching live page from", liveUrl);

  const liveResponse = await fetch(liveUrl, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT
    }
  });

  if (!liveResponse.ok) {
    throw new Error(`Failed to fetch live page (${liveResponse.status}).`);
  }

  const html = await liveResponse.text();
  console.log("[fetchStreamUrlViaHttp] Got HTML, length:", html.length);

  const liveJsUrl = extractLiveJsUrl(html);
  console.log("[fetchStreamUrlViaHttp] Extracted liveJsUrl:", liveJsUrl);

  if (!liveJsUrl) {
    throw new Error("Failed to find liveJsUrl in page HTML.");
  }

  console.log("[fetchStreamUrlViaHttp] Fetching playlist from", liveJsUrl);

  const playlistResponse = await fetch(liveJsUrl, {
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.881903.com/",
      "User-Agent": DEFAULT_USER_AGENT
    }
  });

  console.log("[fetchStreamUrlViaHttp] Playlist response status:", playlistResponse.status);

  if (!playlistResponse.ok) {
    throw new Error(`Failed to fetch playlist.js (${playlistResponse.status}).`);
  }

  const playlistJs = await playlistResponse.text();
  const m3u8Url = extractM3u8Url(playlistJs);
  if (!m3u8Url) {
    throw new Error("Failed to extract .m3u8 URL from playlist.js.");
  }

  return {
    url: m3u8Url,
    fetchedAtMs: Date.now()
  };
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
  if (isVercelRuntime()) {
    return fetchStreamUrlViaHttp(channel);
  }

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
