// src/server/indexnow.ts
//
// IndexNow (Bing, Yandex, Seznam, Naver) instant URL submission. Google does not
// use IndexNow. The key is public by design: it is served at /{KEY}.txt so the
// search engine can verify ownership (public/7d265f900258875f39df25a3da9d379f.txt).

import { site } from "../data/site.js";

export const INDEXNOW_KEY = "7d265f900258875f39df25a3da9d379f";
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Best-effort ping. Never throws: publishing must not depend on a third party. */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  const list = [...new Set(urls.filter((u) => u.startsWith(site.url)))];
  if (!list.length) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(site.url).host,
        key: INDEXNOW_KEY,
        keyLocation: `${site.url}/${INDEXNOW_KEY}.txt`,
        urlList: list
      }),
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch (error) {
    console.warn("[indexnow] submission failed:", error);
    return false;
  }
}
