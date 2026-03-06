import type { Channel } from "./stream-utils.js";
import { fetchStreamUrl, type StreamFetchResult } from "./stream-service.js";

const CACHE_TTL_MS = 10 * 60 * 1000;

export type CacheEntry = {
  url: string;
  fetchedAtMs: number;
  expiresAtMs: number;
  cached: boolean;
};

const cache = new Map<Channel, CacheEntry>();
const inflight = new Map<Channel, Promise<CacheEntry>>();

const buildEntry = (result: StreamFetchResult, cached: boolean): CacheEntry => {
  return {
    url: result.url,
    fetchedAtMs: result.fetchedAtMs,
    expiresAtMs: result.fetchedAtMs + CACHE_TTL_MS,
    cached
  };
};

const isFresh = (entry: CacheEntry) => entry.expiresAtMs > Date.now();

export const getStreamCache = (channel: Channel): CacheEntry | null => {
  const entry = cache.get(channel);
  if (!entry) {
    return null;
  }
  return isFresh(entry) ? { ...entry, cached: true } : null;
};

export const getStreamUrlCached = async (channel: Channel): Promise<CacheEntry> => {
  const existing = getStreamCache(channel);
  if (existing) {
    return existing;
  }

  const existingInflight = inflight.get(channel);
  if (existingInflight) {
    return existingInflight;
  }

  const request = (async () => {
    const result = await fetchStreamUrl(channel);
    const entry = buildEntry(result, false);
    cache.set(channel, entry);
    return entry;
  })();

  inflight.set(channel, request);

  try {
    return await request;
  } finally {
    inflight.delete(channel);
  }
};
