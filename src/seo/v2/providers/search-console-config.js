/** Runtime configuration helpers for the GSC provider. */

export function getSearchConsoleConfig(env = {}) {
  return {
    clientEmail: env.GSC_CLIENT_EMAIL || "",
    privateKey: env.GSC_PRIVATE_KEY || "",
    siteUrl: env.GSC_SITE_URL || ""
  };
}

export function isSearchConsoleConfigured(env = {}) {
  const config = getSearchConsoleConfig(env);
  return Boolean(config.clientEmail && config.privateKey && config.siteUrl);
}
