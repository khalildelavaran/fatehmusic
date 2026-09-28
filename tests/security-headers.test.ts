import { describe, expect, it } from "vitest";
import { applySecurityHeaders, CONTENT_SECURITY_POLICY } from "../src/security-headers";

const req = (path: string) => new Request("https://fatehmusic.ir" + path);

describe("applySecurityHeaders", () => {
  it("adds baseline headers and CSP to HTML responses", () => {
    const res = applySecurityHeaders(req("/"), new Response("<html></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } }));
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("does not add CSP to non-HTML and never overwrites route headers", () => {
    const res = applySecurityHeaders(req("/sitemap-blog.xml"), new Response("<x/>", { headers: { "Content-Type": "application/xml", "Referrer-Policy": "no-referrer" } }));
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("marks private areas noindex via X-Robots-Tag", () => {
    for (const path of ["/admin", "/admin/posts", "/api/login", "/student/login", "/instructor"]) {
      const res = applySecurityHeaders(req(path), new Response("{}", { headers: { "Content-Type": "application/json" } }));
      expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    }
  });

  it("keeps status and body intact", async () => {
    const res = applySecurityHeaders(req("/x"), new Response("hello", { status: 404 }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("hello");
  });
});
