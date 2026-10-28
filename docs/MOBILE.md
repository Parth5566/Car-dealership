# Phone layout

Started 26 October 2026 after the mobile audit (WebKit at 360, 390, 430 and 768px). Tablet and desktop keep their approved design; every change below applies at **760px and narrower**.

## How it is organised

- `frontend/app/mobile.css` is the phone layer. It is imported last in `app/layout.tsx` and grouped by area (sitewide controls, home, inventory, car page, compare, small text). Prefer adding phone rules here instead of another `max-width` block in `globals.css` or `redesign.css`.
- Components styled with CSS modules keep their phone rules in their own module (`home-experience`, `editorial-guide`, `corporate-cabs`, `site-footer`, `contact`, `floating-contact`).
- Development uses an in-memory webpack cache (`next.config.mjs`). The persistent cache previously served an outdated compiled `globals.css`.

## What changed

| Area                       | Phone behaviour                                                                                                                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropdowns and fields       | All selects are 48px tall with a border and chevron (Safari otherwise draws them 23px tall). Form text is at least 16px so iOS does not zoom on focus. Checkboxes are 22px.                                                                                                                                                |
| Floating call and WhatsApp | Appear after the first 280px of scrolling, so they never cover a page's opening screen. On car pages they are replaced by a fixed **Call / WhatsApp / Test drive** bar, which sits above the comparison tray when it is open.                                                                                              |
| Home                       | Real photograph hero (`images/brand/benefit-drive.webp`, served only to phones through `<picture>`), full-width buttons and quick actions (Sell, Check value, EMI). Listings move up directly after the categories; listing, guide, step and benefit cards scroll sideways. The page went from 17.7 to 10.6 phone screens. |
| Cars and commercial        | Search and **Filters** buttons replace the two-screen filter form. The existing form opens as a bottom sheet (focus moves in, Escape or the backdrop closes it, focus returns) with a fixed **Show vehicles** button. Applied filters show as removable chips.                                                             |
| Car page                   | Full-width swipeable photo, then name, price and specs, then the seller's description. "More to consider" scrolls sideways.                                                                                                                                                                                                |
| Contact                    | Contact options are compact full-width rows; the email no longer breaks mid-word.                                                                                                                                                                                                                                          |
| Compare                    | Two cars fit side by side; with three, the labels stay pinned while the table scrolls.                                                                                                                                                                                                                                     |
| Footer                     | Explore, Tools & selling and Policies fold behind 54px tappable headings with 44px links.                                                                                                                                                                                                                                  |
| Small text                 | The 8px header tagline is hidden on phones; labels have a 12px floor; legal text is 13px.                                                                                                                                                                                                                                  |

## Verification

Same audit script as the report, WebKit, 390px, 15 public pages: fields that trigger iOS zoom 10 → 0, tiny text 365 → 21, undersized tap targets 751 → 408 (most remaining are links inside sentences, which WCAG exempts), and no page scrolls sideways at 360 or 390px. Desktop and tablet screenshots were compared before and after for the home page, car page, cars list and footer.

## Admin panel and blog (26 October 2026)

| Area                     | Phone behaviour                                                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin sections           | One **Admin sections · current page** button opens a two-column grid of every section the staff member can use (`account-nav.tsx`). The old tab strip hid most sections and made Inventory, Staff and Reports wider than the screen (up to 577px on a 390px phone); all admin pages now fit. |
| Admin lists              | Inventory, leads, test drives, customers, seller submissions, staff, audit and the reports table render as cards: the record name as the title, each field with its label (`data-label`), and a full-width action. Tables carry `className="admin-table"`.                                   |
| Admin filters and footer | Search and filter bars are full width with 48px controls. On staff pages the footer keeps the contact strip and legal links and drops the customer banner and link groups.                                                                                                                   |
| Blog editor              | Sticky Save/Publish bar, article-style title (exempt from the 16px form rule via `data-display-text`), and a prompt in the empty editor.                                                                                                                                                     |
| Public blog              | The article's "In this article" list sits before the text, the call-to-action after it, and the byline wraps without dangling separators.                                                                                                                                                    |

Checked in WebKit at 390px against the disposable QA data: no admin or blog page scrolls sideways.
