// src/pages/sitemap-blog.xml.ts
//
// @astrojs/sitemap builds its sitemap by scanning routes at build time, so it
// only ever sees static/prerendered pages. Blog posts are pure SSR (served on
// demand from D1 via src/server/blog.ts), so individual /blog/{slug} URLs
// never make it into sitemap-index.xml / sitemap-0.xml even though each post
// itself has a correct canonical tag. This endpoint fills that gap by
// rendering a standard sitemap for exactly the published posts, generated
// fresh on every request so it always matches what's actually published.

import type { APIRoute } from "astro";
import { getPublishedPosts } from "../server/blog";
import { site } from "../data/site.js";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toLastmod(value?: string | null): string | null {
  if (!value) return null;
  const isoLike = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const urls = posts
    .map((post) => {
      const loc = escapeXml(`${site.url}/blog/${post.slug}`);
      const lastmod = toLastmod(post.updated_at ?? post.published_at);

      return `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
