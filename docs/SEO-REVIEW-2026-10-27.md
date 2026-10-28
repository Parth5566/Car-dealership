# SEO review — 27 October 2026

## Implemented

- The dark featured-services strip is rendered by the shared header on every route using it. The desktop homepage commercial-cab action now has a gold background; mobile styling is preserved.
- Blog, passenger-car and commercial-cab pagination have self-referencing canonical URLs. Search/filter copies remain noindex, with follow enabled. Tracking parameters do not create canonical duplicates.
- Blog metadata includes article-specific author, category, publication/update dates, social metadata and large-image preview permission. BlogPosting uses an actual cover when present, rather than identifying a generic logo as the article image.
- Article proxy handling returns an unavailable route for missing/private articles before streaming; backend outages return 503 instead of a false 404. Admin blog routes require the settings permission.
- Editor SEO guidance describes automatic metadata and title suffixes. The API rejects combined keywords longer than the database's 255-character field.
- `llms.txt` includes recent published posts, all policy links and the sitemap, alongside the existing public-page and contact directory. Public text is escaped for its Markdown representation.
- An idempotent local sample-blog importer supplies an editable buying checklist with author, cover, alternative text and SEO fields. Run `npm run blog:sample` to import it.

## Reviewed and retained

The existing dynamic sitemap includes public discovery routes, real public inventory and published articles, including relevant images and update dates. Drafts, scheduled posts before their publication time, archived posts and private account/admin pages are excluded. A failed API request does not silently produce a partial successful sitemap. Existing robots rules allow public media while excluding private areas; policies retain their deliberate noindex setting. No sitemap or robots rewrite was necessary.

Public-page regression checks cover unique metadata, canonicals, Open Graph/Twitter values, one H1, image alternatives, schema parsing, favicon assets and public image formats. Blog publication preserves original publication dates, uses a distinct modification date and calculates reading time from content. The body renderer maintains heading hierarchy and validates supported document structures and individual image metadata.

## Verification and remaining launch checks

- `npm test` passed after the main changes, including backend validation and frontend regressions.
- Final `npm run test:seo`: 16 passed.
- Final `npm run typecheck`: passed.
- Final isolated production build: passed, including TypeScript and generation of all 52 routes. The active development build directory was not modified.
- HTTP/browser end-to-end execution was blocked by the session's port-binding restriction (EPERM). This review does not claim a new browser or live-production audit.
- Sample import was attempted but blocked by local database access restrictions (EPERM). The article is prepared but has not been inserted by this session. Run `npm run blog:sample` locally.
- Google/Bing verification and IndexNow keys were not configured when checked. Set these when the owner provides them; Search Console submission and production Core Web Vitals checks still require the deployed site/account.

`llms.txt` is an optional discovery proposal, not a guarantee of ranking or indexing. Search-result display and indexing remain search-engine decisions. An SEO review cannot certify rankings.

References: [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article), [pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), [robots metadata](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag), and [llms.txt proposal](https://llmstxt.org/).
