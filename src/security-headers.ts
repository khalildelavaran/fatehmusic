/**
 * Security headers for SSR / Worker responses.
 *
 * Static assets served straight from the ASSETS binding get their headers from
 * public/_headers; everything rendered by the Worker (Astro SSR pages, API
 * routes, dynamic sitemaps) goes through applySecurityHeaders().
 *
 * Existing headers set by a route are never overwritten.
 */

const PRIVATE_PATH = /^\/(?:admin|student|instructor|dashboard|login|api)(?:\/|$)/;

// Third parties actually used by the site: Google Tag Manager / GA4 and the
// Meta Pixel (both loaded after `load` in MainLayout.astro). Fonts are
// self-hosted, so font-src is 'self' only.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Astro inline scripts + JSON-LD need 'unsafe-inline' until nonces are adopted.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com https://www.facebook.com https://connect.facebook.net",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests"
].join("; ");

const BASE_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN"
};

export function applySecurityHeaders(request: Request, response: Response): Response {
  // WebSocket upgrades and redirects-with-null-body edge cases: leave untouched.
  if (response.status === 101) return response;

  let isLocalOrPreview = false;
  try {
    const url = new URL(request.url);
    isLocalOrPreview = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".run.app");
  } catch {}

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    if (isLocalOrPreview && (name === "X-Frame-Options" || name === "Cross-Origin-Opener-Policy")) {
      continue;
    }
    if (!headers.has(name)) headers.set(name, value);
  }

  const contentType = headers.get("Content-Type") || "";
  if (/text\/html/i.test(contentType) && !headers.has("Content-Security-Policy")) {
    const csp = isLocalOrPreview
      ? CONTENT_SECURITY_POLICY.replace("; frame-ancestors 'self'", "")
      : CONTENT_SECURITY_POLICY;
    headers.set("Content-Security-Policy", csp);
  }

  // Belt-and-braces for private application areas (robots.txt + meta already cover pages).
  const { pathname } = new URL(request.url);
  if (PRIVATE_PATH.test(pathname) && !headers.has("X-Robots-Tag")) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
