/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Constants
 * Description: Shared constant values so nothing in the
 * engine has to hardcode a number, string, or schema name.
 * --------------------------------------------------------
 */

export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 160;
export const MAX_KEYWORDS = 15;

export const TWITTER_CARD_TYPE = "summary_large_image";
export const DEFAULT_OG_TYPE = "website";
export const DEFAULT_LOCALE = "fa_IR";

// Schema.org type strings live here so nothing else has to
// spell them out by hand.
export const SCHEMA_TYPES = Object.freeze({
    ORGANIZATION: ["LocalBusiness", "MusicSchool"],
    WEBSITE: "WebSite",
    COURSE: "Course",
    OFFER: "Offer",
    PERSON: "Person",
    AUDIENCE: "Audience",
    FAQ_PAGE: "FAQPage",
    QUESTION: "Question",
    ANSWER: "Answer",
    BREADCRUMB_LIST: "BreadcrumbList",
    LIST_ITEM: "ListItem",
    POSTAL_ADDRESS: "PostalAddress",
    GEO_COORDINATES: "GeoCoordinates",
    OPENING_HOURS_SPEC: "OpeningHoursSpecification"
});

// Saturday-first week order, matching the Iranian calendar,
// used to expand a "شنبه تا پنج‌شنبه" style range into individual days.
export const WEEKDAY_ORDER = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سهشنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه"
];

export const WEEKDAY_SCHEMA_MAP = Object.freeze({
    شنبه: "Saturday",
    یکشنبه: "Sunday",
    دوشنبه: "Monday",
    سهشنبه: "Tuesday",
    چهارشنبه: "Wednesday",
    پنجشنبه: "Thursday",
    جمعه: "Friday"
});
