# NCR Wheelz blog editor

The journal is at `/blog`, with public articles at `/blog/[slug]`. Staff with content/settings permission write under **Admin → Blog posts** (`/admin/blog`). This upgrades the existing blog; it does not add another CMS or require a paid editor service.

## Activate the upgrade

The frontend uses Tiptap **3.32.0** throughout and Mammoth **1.13.0** for Word import. The lockfile records the installed packages. Install frontend dependencies with `npm --prefix frontend ci` on another machine; upgrade the Tiptap family together to avoid mixing exact peer versions. The owner's aligned installation reported zero audit vulnerabilities.

Apply additive migrations `007_blog_rich_media.sql` and `008_blog_keywords.sql` with `npm run db:migrate`, then restart the existing API/development process. **Without 007 every draft save fails** (the save writes `scheduled_at` and `nw_blog_media_refs`); this was the cause of "cannot save a draft" on 26 October 2026, when 006 had been applied but 007 had not. Both were applied to the owner's database that day. Stop an existing `npm run dev` with Ctrl+C before starting another. The migration adds a nullable scheduling date and an article/media reference table; existing articles, authors, publication dates, photos and inventory remain in place. The previous `006_blog.sql` still creates the original blog tables. Existing plain block articles open as equivalent rich content and are converted to rich JSON when saved; no destructive content migration runs.

## Write and format

Add the title and introduction, then write in the visual canvas. At the owner's request (26 October 2026) the toolbar offers article formatting only: undo/redo, **Text / H1 / H2 / H3**, bold, italic, underline, link, bullet and numbered lists, quote, divider line, clear formatting, and the Image, Image library and Import Word tools. Text colour, highlight, text size, alignment, strikethrough, inline code, superscript/subscript, list indent buttons and table insertion were removed. Those formats are also dropped from pasted and imported content (the editor schema no longer has them), and older articles are cleaned of them when opened (`editorArticle` in `lib/blog-document.ts`; H4 becomes H3). Tables imported from Word still keep their contextual row, column and header controls. The backend and public renderer still accept the older formats, so nothing already published breaks.

The public title is the page H1. If the body contains H1, the editor visibly explains that all body headings will move down one level on the public page. Their relative hierarchy and saved editor levels are preserved. For ordinary articles, start body sections with H2.

Use the normal Ctrl/⌘ C, X and V keyboard shortcuts for copying, cutting and pasting. The toolbar shows active formatting and exposes shortcuts in tooltips. Word and character counts update from actual text, including visible captions, without counting formatting, link destinations, image alt text or metadata. Reading time rounds up at 220 words per minute; `BLOG_READING_WPM` can configure the server assumption between 100 and 300. Saved articles send that assumption back to the editor. Empty drafts show zero minutes; non-empty articles have at least one.

## Links

Select text and use **Add or edit link**. The dialog supports display text, an HTTPS URL or internal `/path`, and an optional new tab. Keeping the display text preserves existing inline formatting. Clicking an existing link opens its settings; **Remove link** preserves the words and surrounding formatting. The dialog lists shared public routes and searches published articles and available vehicle listings. There is no automatic keyword linking.

Unsafe protocols, protocol-relative URLs, credentials in URLs, control characters and executable attributes are rejected. Public links opened in a new tab receive `noopener noreferrer`.

## Images and required alternative text

There is no "save the draft first" step. Adding the first image, cover or Word image to a new article silently creates its private draft (the address bar changes to `/admin/blog/{id}` without reloading, and in-progress writing is kept), then uploads it. Images are always stored against an article, so ownership checks are unchanged. Upload JPEG, PNG or WebP images up to 8 MB. The server decodes them, removes metadata, constrains pixel/dimension sizes and saves private WebP assets. It never fetches arbitrary image URLs.

Every supported insertion route—upload, the article's image library, clipboard image, file drop, Word import and replacement—asks for alternative text before changing the article. The modal shows a preview and requires a meaningful description. Whitespace, generic labels and filenames are rejected. An intentional **Decorative image** option stores `alt=""` for non-informative inline images. Covers always require a description through their own modal. Alt text belongs to each image occurrence in the article JSON; reusing an asset does not overwrite another occurrence's description.

Click an inserted image for controls to review its alternative text, replace it, align it, choose 25/50/75/100 percent width, add a visible caption, or remove it. Proportions stay intact and the public renderer limits images to the content width. Captions are separate from alternative text.

Cancelling a review leaves the article unchanged. Duplicate events cannot start overlapping upload/review operations. An uploaded but cancelled or replaced asset stays private and available in that article's library; it is not automatically deleted. Removing an image from the article only removes its reference after a successful save. The media library is scoped to the article, rather than being a shared library across all posts. Draft, archived, scheduled and unreferenced media remain protected by the existing staff access checks.

## Paste and Word import

Paste from Google Docs or Word to retain supported paragraphs, H1–H4, emphasis, lists, tables and valid hyperlinks. Source font families, arbitrary colours, scripts, executable attributes, forms and unsupported embeds are removed while converting into the editor schema. Pasted image files and supported embedded image data use the same upload/review process. Remote hotlinked or temporary image URLs are refused with an explanation; upload those images instead.

Pasting or adding content while an image is selected inserts after that image. Text selections retain normal replacement behaviour. Async image reviews preserve the original insertion position, so opening a modal does not move the content to an unrelated cursor position.

**Word** imports a `.docx` into the same editable canvas after confirming replacement of the current body. Title, author, cover and SEO settings remain unchanged. Conversion runs in a worker with archive entry/decompressed-size limits and a timeout. Every imported image is reviewed separately, even if Word supplied alternative text; that text is shown for review. Cancelling any image review cancels the whole body replacement. Staged uploads remain private. Conversion warnings are displayed for the author to assess.

DOCX limits are 8 MB compressed, 24 MB declared uncompressed, 4,000 archive entries and 30 images. Only JPEG/PNG/WebP embedded images are supported. `.doc`, PDF, macros, remote linked images, original Word page layout and real-time collaborative editing are not supported. Documents with unsupported content may need simplification before import.

## Search engine fields

The **Search engine (SEO)** panel holds the **meta title** (blank uses the post title; counter shows 60 characters, the typical search-result length), **meta description** (blank uses the short introduction; 160-character guide) and **meta keywords** (comma-separated; trimmed, de-duplicated without regard to case, at most 12 keywords of 50 characters, stored in `seo_keywords`). A live preview shows how the result may appear. Published articles output `<meta name="keywords">` when keywords exist. Google ignores that tag; some other tools read it.

## Publication, dates and saving

Each article retains its own **Author / team name**, defaulting to NCR Wheelz. Public bylines and BlogPosting author information use the saved value. The business remains the structured-data publisher.

Publication date/time inputs explicitly use **India Standard Time**; MySQL dates are UTC. Leave the date blank to publish immediately, supply a date for first publication, or choose a future date and **Schedule post**. Draft saves remember the selected date without publishing. Scheduled posts remain absent from public article/list/search/homepage/sitemap/media endpoints until the stored publication time. No background scheduler is required: those endpoints check the database time on every request.

A scheduled post has **Update scheduled post** and **Cancel schedule & save draft** actions. Once a post has actually been published, its original publication date cannot be changed by later edits. The last update time is separate, never predates publication in the public projection, and is reflected in metadata/structured data. Article addresses stay stable after first publication or scheduling.

Saving a published post updates the live article; **Unpublish & save draft** removes it publicly. **Archive post** retains content and images while hiding it; restore it through the admin archive list. Public updates do not require a rebuild. No blog action sends notification email.

Optional **Auto-save this draft** saves after four seconds of inactivity, only for an existing draft. It never publishes or updates a live/scheduled post. Writes are serialized and versioned; edits arriving during a request remain local for the next save. A failure pauses auto-save and preserves the writing. Normal unsaved-change protection covers refresh/close and internal links; stale changes require explicitly reloading the saved version or keeping local writing to recover it.

## Storage and rendering

The existing JSON body column stores a closed Tiptap document vocabulary, not HTML. Backend validation limits document size, nesting, elements, marks and attributes. Image nodes require reviewed accessibility metadata and media ownership. Reference changes, post/version updates and audit entries share a database transaction. A failed save cannot partially publish images or overwrite a newer revision.

The public component renders validated structures through React, never `dangerouslySetInnerHTML`. It also checks URLs and image metadata defensively. Article canonical/sharing metadata, author, publication/update dates, reading time, word count, BlogPosting and breadcrumbs use actual post data. The page contains one title H1, with responsive prose, image captions, link styling and scrollable tables.

## Validation commands

```bash
npm test
npm run typecheck
npm run test:integration
npm run test:browser -- --grep "rich blog|admin writes a private blog"
```

The browser scenarios (`--grep "blog"`) also include adding an image and importing Word into a brand-new unsaved article, and checking the stored SEO fields and the published page's title, description and keywords. The two `rich blog` browser scenarios cover selection formatting, hyperlink lifecycle, image cancellation/reuse/alt restoration, cover review, Word import, paste, safe public rendering, publication metadata, scheduling privacy and a small viewport. Source tests also exercise real Tiptap selection commands and JSON round trips, image transaction filtering, Word conversion, per-use image metadata, auto-save conflicts, API/media ownership and scheduling filters. The backend/frontend production build is part of browser QA startup; no manual build is needed for that command.

Owner verification on 26 October 2026: both targeted `rich blog` scenarios passed against the isolated production build, with migration 007 applied to the disposable database. The owner subsequently confirmed that `npm run test:integration` also passed; no test count was supplied for that run. QA migrations do not migrate the website's actual database.

## Starter article and SEO review — 27 October 2026

Run `npm run blog:sample:plan` to inspect the starter article, then `npm run blog:sample` to publish it in a local development database. The importer requires an active administrator and the existing blog migrations. It creates **Buying a Used Car in Delhi NCR: A Practical Checklist**, with a WebP cover, image-specific alternative text, author, internal links and search metadata. Its 774 words calculate to four minutes at the configured default reading speed. Edit or unpublish it through Admin → Blog posts. Re-running the importer preserves an existing article with the same slug, including its edits and publication status. It refuses production or remote databases.

SEO keywords are limited to 255 characters combined, in addition to the existing 12-phrase and 50-character-per-phrase limits. The title preview includes the site's title suffix; its character guide is not a guarantee of search-result display. Public metadata includes the saved author, category, publication dates and large-image preview permission. BlogPosting images are emitted only when an article has an actual cover. Unfiltered journal pagination has self-referencing canonicals; searches and category filters remain noindex. Missing or private articles are intercepted before streaming to avoid a successful HTTP status on an unavailable article.
