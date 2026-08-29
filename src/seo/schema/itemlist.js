/**
 * Build an ItemList schema for collection/listing pages.
 * Items are represented as stable entity references so the list
 * connects to the site's existing Course and Person nodes.
 */

/**
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.url
 * @param {Array<{name:string,url:string,id?:string}>} params.items
 * @param {string} [params.itemType]
 * @returns {Object}
 */
export function buildItemListSchema({
    name,
    url,
    items = [],
    itemType
} = {}) {
    const normalizedItems = items
        .filter((item) => item && item.name && item.url)
        .map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: {
                "@id": item.id || item.url,
                url: item.url,
                name: item.name,
                ...(itemType ? { "@type": itemType } : {})
            }
        }));

    if (!name || !url || normalizedItems.length === 0) {
        return null;
    }

    return {
        "@type": "ItemList",
        "@id": `${url}#itemlist`,
        name,
        url,
        numberOfItems: normalizedItems.length,
        itemListElement: normalizedItems
    };
}
