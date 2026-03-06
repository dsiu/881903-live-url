import { getStreamUrlCached } from "../src/cache.js";
import { renderHomePage } from "../src/home.js";
import type { Channel } from "../src/stream-utils.js";

const htmlResponse = (body: string) => {
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};

const parseChannel = (pathname: string): Channel | null => {
  const match = pathname.match(/^\/api\/live\/(903|881)$/);
  return match ? (match[1] as Channel) : null;
};

const handleLiveRoute = async (request: Request, channel: Channel) => {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const entry = await getStreamUrlCached(channel);

  if (format === "json") {
    return jsonResponse({
      channel,
      url: entry.url,
      cached: entry.cached,
      fetchedAtMs: entry.fetchedAtMs,
      expiresAtMs: entry.expiresAtMs
    });
  }

  return Response.redirect(entry.url, 302);
};

export default async function handler(request: Request) {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api") {
    return htmlResponse(renderHomePage().replace(/\/live\//g, "/api/live/"));
  }

  const channel = parseChannel(url.pathname);
  if (channel) {
    try {
      return await handleLiveRoute(request, channel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return jsonResponse({ error: message }, 500);
    }
  }

  return new Response("Not Found", { status: 404 });
}
