// Title-only search-intent classification shared with the SEO Intelligence V2 layer.
// Contextual path/entity intent remains in src/seo/v2/intents.js.
import { classifyTitleIntent } from "../../seo/v2/intents.js";
import type { SearchIntent } from "./types";

export function classifyIntent(title: string): SearchIntent {
  return classifyTitleIntent(title).primary as SearchIntent;
}
