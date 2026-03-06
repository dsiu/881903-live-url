import { renderHomePage } from "../src/home.js";
import type { CacheEntry } from "../src/cache.js";
import type { Channel } from "../src/stream-utils.js";

type VercelRequest = {
  method?: string;
  url?: string;
};

type VercelResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

const sendHtml = (res: VercelResponse, body: string) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
};

const sendJson = (res: VercelResponse, body: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const sendRedirect = (res: VercelResponse, location: string) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
};

const parseChannel = (pathname: string, queryChannel?: string | null): Channel | null => {
  if (queryChannel === "903" || queryChannel === "881") {
    return queryChannel as Channel;
  }
  const match = pathname.match(/^\/(?:api\/)?live\/(903|881)$/);
  return match ? (match[1] as Channel) : null;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Stream fetch timed out.")), timeoutMs);
    })
  ]);
};

const handleLiveRoute = async (req: VercelRequest, res: VercelResponse, channel: Channel) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const format = url.searchParams.get("format");

  const { getStreamCache, getStreamCacheEntry, getStreamUrlCached } = await import(
    "../src/cache.js"
  );
  let entry: CacheEntry;
  const cached = getStreamCache(channel);

  if (cached) {
    entry = cached;
  } else {
    try {
      entry = await withTimeout(getStreamUrlCached(channel), 20000);
    } catch (error) {
      const stale = getStreamCacheEntry(channel);
      if (stale) {
        entry = { ...stale, cached: true };
      } else {
        throw error;
      }
    }
  }

  if (format === "json") {
    sendJson(res, {
      channel,
      url: entry.url,
      cached: entry.cached,
      fetchedAtMs: entry.fetchedAtMs,
      expiresAtMs: entry.expiresAtMs
    });
    return;
  }

  sendRedirect(res, entry.url);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");

  const channel = parseChannel(url.pathname, url.searchParams.get("channel"));

  if (url.pathname === "/" || url.pathname === "/api") {
    if (!channel) {
      sendHtml(res, renderHomePage());
      return;
    }
  }

  if (!channel) {
    if (url.searchParams.get("format") === "json") {
      sendJson(res, { error: "Missing or invalid channel." }, 400);
      return;
    }
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }

  try {
    await handleLiveRoute(req, res, channel);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, { error: message }, 500);
  }
}
