import { extractLiveJsUrl, extractM3u8Url, LIVE_URLS, type Channel } from "./stream-utils.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";


const fetchStreamUrlViaHttp = async (channel: Channel): Promise<StreamFetchResult> => {
  const liveUrl = LIVE_URLS[channel];
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
    throw new Error("Failed to find liveJsUrl in page HTML.");
  }

  const playlistResponse = await fetch(liveJsUrl, {
    headers: {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.881903.com/",
      "User-Agent": DEFAULT_USER_AGENT
    }
  });

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

const isVercelRuntime = () => {
  return !!(process.env.VERCEL || process.env.VERCEL_URL || process.env.AWS_REGION);
};

export const fetchStreamUrl = async (channel: Channel): Promise<StreamFetchResult> => {
  // Browser automation doesn't work reliably on Vercel, always use HTTP fetch
  return fetchStreamUrlViaHttp(channel);
};
