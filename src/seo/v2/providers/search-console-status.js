import { createGoogleSearchConsoleClient } from "./search-console-client.js";

export function getSearchConsoleStatus(env = {}) {
  const configured = Boolean(env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY && env.GSC_SITE_URL);
  return {
    provider: "google-search-console",
    configured,
    state: configured ? "configured" : "not_configured",
    siteUrl: env.GSC_SITE_URL || null
  };
}

export async function testSearchConsoleConnection(env = {}, options = {}) {
  const status = getSearchConsoleStatus(env);
  if (!status.configured) return { ...status, ok: false, error: "GSC_NOT_CONFIGURED" };

  try {
    const client = createGoogleSearchConsoleClient({
      clientEmail: env.GSC_CLIENT_EMAIL,
      privateKey: env.GSC_PRIVATE_KEY,
      siteUrl: env.GSC_SITE_URL,
      fetchImpl: options.fetchImpl || fetch
    });
    const result = await client.querySearchAnalytics({
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: ["query", "page"],
      rowLimit: 1
    });
    return { ...status, ok: true, state: "connected", sampleRows: result.rows.length };
  } catch (error) {
    return {
      ...status,
      ok: false,
      state: "error",
      error: error instanceof Error ? error.message : "GSC_CONNECTION_FAILED"
    };
  }
}
