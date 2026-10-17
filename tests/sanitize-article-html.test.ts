import { describe, expect, it } from "vitest";
import { isHtmlArticleContent, sanitizeArticleHtml } from "../src/utils/sanitize-article-html";

describe("article HTML sanitizer", () => {
  it("keeps common formatting and safe links while removing executable markup", () => {
    const result = sanitizeArticleHtml(
      '<div onclick="alert(1)"><p style="color:#aabbcc;font-size:18px;background-image:url(javascript:alert(1))">متن <strong>مهم</strong></p>' +
      '<a href="https://example.com/?a=1&amp;b=2" onmouseover="alert(1)">پیوند</a>' +
      '<script>alert(1)</script><iframe src="https://evil.example"></iframe>' +
      '<img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)" alt="تصویر"></div>'
    );

    expect(result).toContain("<strong>مهم</strong>");
    expect(result).toContain('style="color:#aabbcc;font-size:18px"');
    expect(result).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(result).toContain('alt="تصویر"');
    expect(result).not.toMatch(/onclick|onmouseover|onerror|javascript:|<script|<iframe|data:image/i);
  });

  it("rejects encoded script URLs and preserves only safe URL attributes", () => {
    const result = sanitizeArticleHtml(
      '<p><a href="java&#x73;cript&colon;alert(1)">مخرب</a> ' +
      '<a href="javascript:alert(1)">ناامن</a> ' +
      '<a href="/courses/guitar">داخلی</a></p>'
    );

    expect(result).not.toMatch(/href="java|href="javascript/i);
    expect(result).toContain('href="/courses/guitar"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("distinguishes legacy Markdown from rich HTML content", () => {
    expect(isHtmlArticleContent("## عنوان مقاله\\n\\nمتن")).toBe(false);
    expect(isHtmlArticleContent("<div><p>متن</p></div>")).toBe(true);
    expect(isHtmlArticleContent("<script>alert(1)</script>")).toBe(true);
  });
});
