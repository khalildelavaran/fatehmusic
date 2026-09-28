/**
 * Fateh Music Academy — Image Gallery Schema
 * Describes gallery assets as first-class ImageObject nodes.
 */

import { SCHEMA_TYPES } from "../config/constants.js";
import { absoluteUrl, webPageEntityId } from "../helpers/url.js";

/**
 * @param {{site:{url:string},url:string,name:string,description:string,items?:ReadonlyArray<{image:string,title:string,subtitle?:string}>}} params
 */
export function buildImageGallerySchema({ site, url, name, description, items = [] } = {}) {
    const galleryUrl = absoluteUrl(url, site.url);
    const webpageId = webPageEntityId(galleryUrl);

    const imageNodes = items
        .filter((item) => item?.image && item?.title)
        .map((item) => {
            const imageUrl = absoluteUrl(item.image, site.url);
            return {
                "@type": SCHEMA_TYPES.IMAGE_OBJECT,
                "@id": imageUrl + "#image",
                url: imageUrl,
                contentUrl: imageUrl,
                name: item.title,
                caption: item.title,
                description: item.subtitle || item.title,
                representativeOfPage: false,
                mainEntityOfPage: { "@id": webpageId }
            };
        });

    if (!galleryUrl || !name || imageNodes.length === 0) return null;

    const imageRefs = imageNodes.map((image) => ({ "@id": image["@id"] }));

    return [
        {
            "@type": SCHEMA_TYPES.IMAGE_GALLERY,
            "@id": galleryUrl.replace(/\/$/, "") + "#image-gallery",
            url: galleryUrl,
            name,
            description,
            inLanguage: "fa-IR",
            isPartOf: { "@id": site.url + "/#website" },
            about: { "@id": site.url + "/#organization" },
            publisher: { "@id": site.url + "/#organization" },
            mainEntityOfPage: { "@id": webpageId },
            associatedMedia: imageRefs,
            image: imageRefs
        },
        ...imageNodes
    ];
}
