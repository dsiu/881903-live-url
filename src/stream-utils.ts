export const DEFAULT_CHANNEL = "903" as const;

export type Channel = "903" | "881";

export const LIVE_URLS: Record<Channel, string> = {
  "903": "https://www.881903.com/live/903",
  "881": "https://www.881903.com/live/881"
};

export const findFirstMatch = (text: string, regex: RegExp) => {
  const match = text.match(regex);
  return match ? match[0] : null;
};

export const extractLiveJsUrl = (html: string) => {
  const liveJsRegex = /"liveJsUrl"\s*:\s*"(https:\/\/playlist\.881903\.com\/[^\"]+)"/;
  const match = html.match(liveJsRegex);
  return match ? match[1].replace(/\\/g, "") : null;
};

export const extractM3u8Url = (text: string) => {
  const m3u8Regex = /https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/;
  return findFirstMatch(text, m3u8Regex);
};
