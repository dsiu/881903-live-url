#!/usr/bin/env bun
import { getStreamUrlCached } from "./cache.js";
import { type Channel } from "./stream-utils.js";
import { renderHomePage } from "./home.js";

const DEFAULT_PORT = 3000;

const parseChannel = (pathname: string): Channel | null => {
  const match = pathname.match(/^\/live\/(903|881)$/);
  return match ? (match[1] as Channel) : null;
};

const getPort = () => {
  const envPort = process.env.PORT;
  if (!envPort) {
    return DEFAULT_PORT;
  }
  const parsed = Number(envPort);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
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

const htmlResponse = (body: string) => {
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};

const serveHome = () => htmlResponse(renderHomePage());

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

const handleRequest = async (request: Request) => {
  const url = new URL(request.url);
  const channel = parseChannel(url.pathname);

  if (url.pathname === "/") {
    return serveHome();
  }

  if (channel) {
    try {
      return await handleLiveRoute(request, channel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return jsonResponse({ error: message }, 500);
    }
  }

  return new Response("Not Found", { status: 404 });
};

Bun.serve({
  port: getPort(),
  fetch: handleRequest
});

console.log(`Server listening on http://localhost:${getPort()}`);
