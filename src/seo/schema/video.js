/** Fateh Music Academy — VideoObject schema builder. */
export function buildVideoSchema(video, { site, url, creator } = {}) {
    if (!video?.name || !video?.thumbnailUrl || !video?.uploadDate) return null;
    const pageUrl = url ? String(url).replace(/\/$/, "") : undefined;
    const node = {
        "@type": "VideoObject",
        "@id": video.id ? pageUrl + "#video-" + video.id : pageUrl + "#video",
        name: video.name, description: video.description,
        thumbnailUrl: toAbsolute(video.thumbnailUrl, site?.url),
        uploadDate: toIso(video.uploadDate),
        contentUrl: video.contentUrl ? toAbsolute(video.contentUrl, site?.url) : undefined,
        embedUrl: video.embedUrl ? toAbsolute(video.embedUrl, site?.url) : undefined,
        duration: video.duration,
        expires: video.expires ? toIso(video.expires) : undefined,
        ineligibleRegion: video.ineligibleRegion, regionsAllowed: video.regionsAllowed,
        mainEntityOfPage: pageUrl ? { "@id": pageUrl + "#webpage" } : undefined,
        creator: creator ? { "@type": creator.type || "Person", name: creator.name, url: creator.url ? toAbsolute(creator.url, site?.url) : undefined } : undefined,
        author: creator ? { "@type": creator.type || "Person", name: creator.name, url: creator.url ? toAbsolute(creator.url, site?.url) : undefined } : undefined,
        hasPart: Array.isArray(video.clips) && video.clips.length ? video.clips.map((clip) => ({
            "@type": "Clip", name: clip.name, startOffset: Number(clip.startOffset),
            endOffset: clip.endOffset != null ? Number(clip.endOffset) : undefined,
            url: clip.url ? toAbsolute(clip.url, site?.url) : undefined
        })) : undefined
    };
    return prune(node);
}
function toAbsolute(value, base) { if (!value) return value; try { return new URL(value, base || undefined).toString(); } catch { return value; } }
function toIso(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); }
function prune(value) {
    if (Array.isArray(value)) return value.map(prune).filter(Boolean);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prune(item)]).filter(([, item]) => item !== undefined && item !== null && !(Array.isArray(item) && item.length === 0)));
}
