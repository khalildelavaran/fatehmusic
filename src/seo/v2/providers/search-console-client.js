/**
 * Server-side Google Search Console REST client for Cloudflare Workers.
 * No Google SDK is required; the Worker uses Web Crypto and fetch.
 * Credentials are supplied at runtime through Cloudflare secrets.
 */

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3/sites";

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createServiceAccountJwt({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: GSC_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

async function getAccessToken({ clientEmail, privateKey, fetchImpl = fetch }) {
  const assertion = await createServiceAccountJwt({ clientEmail, privateKey });
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC_AUTH_FAILED:${response.status}:${text.slice(0, 300)}`);
  }
  const data = await response.json();
  if (!data.access_token) throw new Error("GSC_AUTH_FAILED:NO_ACCESS_TOKEN");
  return data.access_token;
}

export function createGoogleSearchConsoleClient({ clientEmail, privateKey, siteUrl, fetchImpl = fetch } = {}) {
  const configured = Boolean(clientEmail && privateKey && siteUrl);

  return {
    configured,
    async querySearchAnalytics({ startDate, endDate, dimensions = ["query", "page"], rowLimit = 25000, startRow = 0, dataState = "final" } = {}) {
      if (!configured) return { configured: false, rows: [], error: "GSC_NOT_CONFIGURED" };
      if (!startDate || !endDate) throw new Error("GSC_DATE_RANGE_REQUIRED");

      const token = await getAccessToken({ clientEmail, privateKey, fetchImpl });
      const encodedSite = encodeURIComponent(siteUrl);
      const response = await fetchImpl(`${GSC_BASE}/${encodedSite}/searchAnalytics/query`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow, dataState })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GSC_QUERY_FAILED:${response.status}:${text.slice(0, 300)}`);
      }

      const data = await response.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return {
        configured: true,
        rows: rows.map((row) => ({
          keys: Array.isArray(row.keys) ? row.keys : [],
          clicks: Number(row.clicks) || 0,
          impressions: Number(row.impressions) || 0,
          ctr: Number(row.ctr) || 0,
          position: Number(row.position) || 0
        })),
        responseAggregationType: data.responseAggregationType || null,
        metadata: data.metadata || null
      };
    }
  };
}

export { GSC_SCOPE };
