// src/pages/rss.xml.ts
//
// RSS 2.0 feed of published blog posts (served from D1 like sitemap-blog.xml).
// Gives feed readers, aggregators and AI retrieval tools a machine-readable,
// freshness-stamped index of the articles.

import type { APIRoute } from "astro";
import { getPublishedPostsStrict } from "../server/blog";
import { site } from "../data/site.js";

export const prerender = false;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function toRfc822(value?: string | null): string | null {
  if (!value) return null;
  const isoLike = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

export const GET: APIRoute = async () => {
  let posts;
  try {
    posts = await getPublishedPostsStrict();
  } catch (error) {
    console.error("[rss] failed to load published posts:", error);
    return new Response("Feed temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const items = posts.slice(0, 50).map((post) => {
    const url = escapeXml(`${site.url}/blog/${post.slug}`);
    const pubDate = toRfc822(post.published_at ?? post.created_at);
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      pubDate ? `      <pubDate>${pubDate}</pubDate>` : null,
      post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : null,
      "    </item>"
    ].filter(Boolean).join("\n");
  }).join("\n");

  const lastBuild = toRfc822(posts[0]?.updated_at ?? posts[0]?.published_at) ?? new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>${escapeXml(site.name)} | مقالات آموزشی</title>\n    <link>${site.url}/blog</link>\n    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />\n    <description>مقالات آموزشی موسیقی آموزشگاه موسیقی فاتح شوشتر</description>\n    <language>fa-IR</language>\n    <lastBuildDate>${lastBuild}</lastBuildDate>\n${items}\n  </channel>\n</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
    }
  });
};
