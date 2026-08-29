/**
 * --------------------------------------------------------
 * Fateh Music Academy — SEO Engine
 * Module: Constants
 * Description:
 * Shared constant values so nothing in the engine has to
 * hardcode a number, string, or schema name.
 * --------------------------------------------------------
 */

export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 160;
export const MAX_KEYWORDS = 15;
export const TWITTER_CARD_TYPE = "summary_large_image";
export const DEFAULT_OG_TYPE = "website";
export const DEFAULT_LOCALE = "fa_IR";

export const SCHEMA_TYPES = Object.freeze({
    LOCAL_EDUCATION_BUSINESS: "LocalBusiness",
    EDUCATIONAL_ORGANIZATION: "EducationalOrganization",
    ORGANIZATION: "Organization",
    WEBSITE: "WebSite",
    COURSE: "Course",
    COURSE_INSTANCE: "CourseInstance",
    ARTICLE: "Article",
    PERSON: "Person",
    EVENT: "Event",
    ADMINISTRATIVE_AREA: "AdministrativeArea",
    PLACE: "Place",
    OFFER: "Offer",
    AUDIENCE: "Audience",
    FAQ_PAGE: "FAQPage",
    QUESTION: "Question",
    ANSWER: "Answer",
    BREADCRUMB_LIST: "BreadcrumbList",
    LIST_ITEM: "ListItem",
    POSTAL_ADDRESS: "PostalAddress",
    COUNTRY: "Country",
    CITY: "City",
    GEO_COORDINATES: "GeoCoordinates",
    OPENING_HOURS_SPEC: "OpeningHoursSpecification",
    ABOUT_PAGE: "AboutPage",
    CONTACT_PAGE: "ContactPage"
});

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
