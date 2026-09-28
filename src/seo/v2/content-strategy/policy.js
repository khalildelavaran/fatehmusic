export const INTENT_PRIORITY = Object.freeze({
  transactional: 100,
  local: 92,
  commercial: 84,
  informational: 70,
  navigational: 58
});

export const INTENT_SUFFIX = Object.freeze({
  informational: "راهنمای جامع",
  commercial: "راهنمای انتخاب",
  transactional: "هزینه و ثبت‌نام",
  local: "در شوشتر",
  navigational: "معرفی و مسیر دسترسی"
});

export const INTENTS = Object.freeze([
  "informational",
  "commercial",
  "transactional",
  "local",
  "navigational"
]);

export const COMPATIBLE_INTENTS = Object.freeze({
  local: new Set(["local", "commercial", "transactional"]),
  commercial: new Set(["local", "commercial", "transactional"]),
  transactional: new Set(["local", "commercial", "transactional"]),
  informational: new Set(["informational"]),
  navigational: new Set(["navigational"])
});

export const SCOPE_ONLY_TOPICS = Object.freeze(new Set(["shushtar"]));

export function areIntentsCompatible(a, b) {
  return Boolean(COMPATIBLE_INTENTS[a]?.has(b) && COMPATIBLE_INTENTS[b]?.has(a));
}

export function choosePrimaryIntent(intents = []) {
  return [...new Set(intents)]
    .sort((a, b) => (INTENT_PRIORITY[b] ?? 0) - (INTENT_PRIORITY[a] ?? 0))[0] || "informational";
}

export function mergeIntents(a = [], b = []) {
  return [...new Set([...a, ...b])].filter((intent) => INTENTS.includes(intent));
}
