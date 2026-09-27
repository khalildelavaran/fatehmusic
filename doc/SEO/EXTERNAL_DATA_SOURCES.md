# منابع داده‌ی خارجی موتور SEO

## Google Search Console

Secrets:

- GSC_CLIENT_EMAIL
- GSC_PRIVATE_KEY
- GSC_SITE_URL

The service account must have read access to the verified Search Console property.

## Ahrefs

Optional secret:

- AHREFS_API_KEY

Optional variables:

- AHREFS_COUNTRY=IR
- AHREFS_TARGET_URL=https://fatehmusic.ir
- GSC_SYNC_BREAKDOWNS=1

Ahrefs API v3 supplies keyword metrics such as search volume and difficulty, plus Site Explorer organic competitors, refdomains, metrics and organic keywords. The Worker stores these values in D1 before they are used for scoring. It never substitutes fabricated volume or difficulty.

Because Ahrefs API requests consume units, the implementation batches keyword requests and refreshes market snapshots weekly.

## Production validation

- npm run seo:audit: build-time rendered audit.
- npm run seo:live-audit: production HTTP audit.
- Lighthouse SEO & Performance Audit: weekly real-browser performance/SEO measurement.
