/**
 * Canonical dimension contract for Google Search Console query/page data.
 *
 * The SEO reasoning layer expects unsegmented query/page rows. Country,
 * device and search-appearance breakdowns are useful reporting dimensions,
 * but must never be silently mixed into the canonical scoring dataset.
 */

export function hasGscBreakdownDimensions(row = {}) {
  return Boolean(
    String(row?.country || "").trim() ||
    String(row?.device || "").trim() ||
    String(row?.searchAppearance || row?.search_appearance || "").trim()
  );
}

export function classifyGscDimensionMix(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  let canonicalRows = 0;
  let breakdownRows = 0;

  for (const row of safeRows) {
    if (hasGscBreakdownDimensions(row)) breakdownRows += 1;
    else canonicalRows += 1;
  }

  const dimensionMode =
    breakdownRows === 0 ? "QUERY_PAGE" :
    canonicalRows === 0 ? "BREAKDOWN" :
    "MIXED";

  return Object.freeze({
    canonicalRows,
    breakdownRows,
    totalRows: safeRows.length,
    dimensionMode,
    mixed: canonicalRows > 0 && breakdownRows > 0
  });
}

export function filterCanonicalGscRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => !hasGscBreakdownDimensions(row));
}

export function sanitizeGscQueryPageRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const profile = classifyGscDimensionMix(safeRows);

  if (profile.dimensionMode === "QUERY_PAGE") {
    return Object.freeze(safeRows);
  }

  return Object.freeze(filterCanonicalGscRows(safeRows));
}
