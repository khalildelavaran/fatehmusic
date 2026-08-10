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

/**
 * Schema.org type strings
 */
export const SCHEMA_TYPES = Object.freeze({

    // Main Entity
    LOCAL_EDUCATION_BUSINESS: "MusicSchool",

    WEBSITE: "WebSite",

    // Content Entities
    COURSE: "Course",
    PERSON: "Person",
    EVENT: "Event",

    // Commercial
    OFFER: "Offer",

    // Audience
    AUDIENCE: "Audience",

    // FAQ
    FAQ_PAGE: "FAQPage",
    QUESTION: "Question",
    ANSWER: "Answer",

    // Navigation
    BREADCRUMB_LIST: "BreadcrumbList",
    LIST_ITEM: "ListItem",

    // Address
    POSTAL_ADDRESS: "PostalAddress",
    COUNTRY: "Country",
    CITY: "City",

    // Geo
    GEO_COORDINATES: "GeoCoordinates",

    // Business hours
    OPENING_HOURS_SPEC: "OpeningHoursSpecification",

    // Pages
    ABOUT_PAGE: "AboutPage"
});

/**
 * Saturday-first week order,
 * matching Iranian calendar
 */
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