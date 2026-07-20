/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Text Helpers
 * --------------------------------------------------------
 */

import { WEEKDAY_ORDER, WEEKDAY_SCHEMA_MAP } from "../config/constants.js";

/**
 * Trims and collapses whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
}

/**
 * Truncates text on a word boundary instead of mid-word.
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength) {
    const value = clean(text);

    if (!value || value.length <= maxLength) {
        return value;
    }

    const cut = value.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");

    return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

/**
 * Removes zero-width non-joiners so "پنج‌شنبه" and "پنجشنبه"
 * compare as the same word.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripZwnj(text) {
    return (text || "").replace(/\u200c/g, "");
}

/**
 * Converts Persian/Arabic-Indic digits to Latin digits, since
 * schema.org time values must be plain ASCII (e.g. "16:00").
 *
 * @param {string} text
 * @returns {string}
 */
export function toLatinDigits(text) {
    const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

    return (text || "").replace(/[۰-۹٠-٩]/g, (char) => {
        const persianIndex = persianDigits.indexOf(char);
        if (persianIndex > -1) {
            return String(persianIndex);
        }
        return String(arabicDigits.indexOf(char));
    });
}

/**
 * Expands a Persian day label ("شنبه" or a range like
 * "شنبه تا پنج‌شنبه") into schema.org weekday names.
 *
 * @param {string} label
 * @returns {string[]}
 */
export function expandWeekdayRange(label) {
    const parts = stripZwnj(label)
        .split("تا")
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length === 1) {
        const single = WEEKDAY_SCHEMA_MAP[parts[0]];
        return single ? [single] : [];
    }

    const startIndex = WEEKDAY_ORDER.indexOf(parts[0]);
    const endIndex = WEEKDAY_ORDER.indexOf(parts[1]);

    if (startIndex === -1 || endIndex === -1) {
        return [];
    }

    return WEEKDAY_ORDER.slice(startIndex, endIndex + 1).map(
        (day) => WEEKDAY_SCHEMA_MAP[day]
    );
}

/**
 * Removes duplicate, falsy, and overly-long entries from an
 * array of keywords/strings while preserving order.
 *
 * @param {string[]} items
 * @returns {string[]}
 */
export function dedupe(items) {
    return [...new Set((items || []).filter(Boolean))];
}
