# NCR Wheelz content and visual expansion plan

Research date: 25 October 2026. Proposal only: no website components, routes, database content or public assets changed during this review.

## Recommendation

Give NCR Wheelz a stronger local identity through original vehicle and showroom photography, real customer stories, useful buying advice and a few playful discovery tools. Concentrate substantial additions on the homepage, About, passenger inventory, commercial inventory, vehicle details and a public selling introduction. Keep forms and account tools focused.

The existing navy, teal, gold and warm white palette can support this. Use photographs, alternating section layouts and restrained movement to create variety. Keep headings compact and placeholders short, consistent with the owner's earlier preferences. Retain the approved terms Variant, Transmission, Loan tenure, Kilometres driven and Mileage/fuel economy.

## Current website findings

- The homepage already contains search, category cards, passenger/commercial stock, process/value cards, a seller banner and buying FAQs. Improve these and add a few distinct sections rather than duplicating them.
- The only asset currently in `frontend/public` is `hero.svg`. Listing media is served separately, so this does not mean the website has no vehicle photographs; it means there is little original editorial imagery bundled for its marketing pages.
- About already contains a story, values, static testimonial cards, a visit prompt and FAQs. The actual testimonial collection is empty and the displayed fallback stories are explicitly fictional samples.
- Inventory pages already contain working filters, stock cards, sorting, pagination and FAQs. Add discovery and buying guidance around the inventory without pushing the cars far down the page.
- Vehicle detail pages already have a gallery/full-screen viewer, specifications, seller description/features, enquiry, test-drive actions, an EMI link and similar vehicles.
- EMI already includes a repayment chart, total interest and a yearly repayment breakdown. New work should explain scenarios rather than recreate those features.
- Contact already includes enquiry, contact information, hours, directions, a map and FAQs. Its main opportunity is a more recognisable physical showroom presence.
- `/sell` is protected by authentication. It works as a submission form but is not an effective public introduction for people researching how to sell a car.
- The finance page states that no lender partnership/application service is configured. Proposed content must match that actual service level.

## Reference websites and adaptable ideas

These observations come from the accessible page content. The reference sites' commercial claims are their own; they are not NCR Wheelz promises. No competitor copy, customer photos or testimonials should be reused.

| Reference visited                                                                                                         | Relevant pattern observed                                                                                              | NCR Wheelz adaptation                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [Spinny homepage](https://www.spinny.com/)                                                                                | Customer stories with photographs, buying-process explanations, benefit sections and ways to browse vehicles.          | Real delivery stories, a concise visual buying journey and stronger car discovery.                                                        |
| [CarWale used cars](https://www.carwale.com/used/)                                                                        | Shopping by brand/transmission/fuel, buyer types such as first-time and family buyers, and a buyer's guide collection. | Friendly shopping shortcuts plus a small library of original, practical guides.                                                           |
| [Cars24 New Delhi inventory](https://www.cars24.com/buy-used-cars-new-delhi/)                                             | Local inventory with vehicle details, location, pricing and finance context.                                           | Useful Delhi NCR context and clear listing information; keep any estimated EMI assumptions visible.                                       |
| [Big Boy Toyz](https://www.bigboytoyz.com/)                                                                               | Vehicle collections, showroom discovery and connections to guides and brand information.                               | A distinctive showroom story and carefully curated collections suitable for NCR Wheelz's actual stock.                                    |
| [Google Search Central: helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Original, useful, people-first information; no preferred word count.                                                   | Answer specific buyer/seller questions with original experience and maintained facts, instead of adding text to meet an arbitrary length. |

## Page-by-page additions

### 1. Homepage — first priority

1. **A photographic hero.** Commission a strong image of real NCR Wheelz stock/showroom activity. Keep the main browsing action visible. An optional short video can open on click from a still image.
2. **“Find a car for your next chapter.”** Four illustrated/photo tiles: city commuting, family trips, first car and business use. Use measurable filters or curated selections; do not imply suitability has been assessed when it has not.
3. **“New keys. Real stories.” customer slider.** Delivery photograph, short authentic quote, customer first name, purchased vehicle and delivery month. Link to an expanded story or authorised video.
4. **“One minute at NCR Wheelz.”** A short showroom/team/vehicle walkaround video with a preview image and captions.
5. **A visual buying journey.** Shortlist → ask questions → request a test drive → confirm details with the team. Explain the real process without promising checkout, instant reservation or guaranteed delivery.
6. **A compact local introduction.** Describe passenger and commercial inventory, the Tilak Nagar showroom and how to arrange a visit. Link naturally to inventory, selling and Contact.
7. **Three useful guide cards.** Featured original advice rather than a large news feed.

Suggested order: hero/search → visual shopping shortcuts → actual stock → customer stories → buying journey/showroom film → commercial spotlight → guide cards → visit prompt/FAQs.

Suggested SEO direction: used cars in Delhi NCR; used car showroom in Tilak Nagar. Include the location naturally in meaningful copy, not in every heading.

### 2. Passenger cars — first priority

1. A compact row of photographed body-style or budget shortcuts above results, linked to working filters. Existing filters remain the main control.
2. A small “Not sure where to start?” card linking to the car finder or a buying guide.
3. Original guidance below the stock: choosing a budget, understanding kilometres driven versus fuel economy, and arranging a test drive.
4. Related guide cards such as “First used car: a practical checklist” and “Manual or automatic: what to compare.”
5. Improve the existing FAQs with questions actually received by the showroom, avoiding repetition of homepage answers.

Suggested headings: “Used cars in Delhi NCR” and “What to check before shortlisting a used car.” Inventory remains immediately accessible on mobile.

### 3. Commercial vehicles — first priority

1. **“What does your business need to move?”** Photo tiles for vehicle categories/use cases supported by real stock: pickups, compact goods carriers and other stocked types.
2. A simple visual explanation of load capacity and useful measurements. Show only verified values on listings.
3. An owner story showing an actual business customer and their vehicle, with permission.
4. A commercial buying checklist: condition, service records, running-cost questions and documents to discuss before purchase. Link out to dated authoritative material where rules are involved.
5. Category-specific FAQs and links to relevant live vehicles.

Suggested SEO direction: used commercial vehicles in Delhi NCR, with specific stocked vehicle categories where appropriate. Avoid claiming income, profitability or suitability for a particular permit/use without evidence.

### 4. Vehicle details — first priority

1. Add a consistent photography checklist: exterior angles, cabin, dashboard/odometer, boot/load area, tyres and disclosed defects. A complete photo set makes this page richer immediately.
2. Optional short walkaround video for each real listing.
3. An editor-written “What stands out” summary based on the individual car's recorded features and condition. Show it only when there is meaningful information to say.
4. Structured condition/service information when staff have actually recorded it, with dates and a clear distinction between seller-provided and inspected information. Never turn document approval into a mechanical-inspection badge.
5. A concise “Before you visit” checklist: confirm availability, request a test drive and bring the details the team actually requires.
6. Improve the existing similar-vehicle section using genuine matching criteria such as category and budget, with explanations such as “Similar asking price.”

SEO content should be unique to the actual listing: year, brand, model, variant, location and supported details. Do not fill missing history with generated claims. Preserve private seller documents/contact boundaries.

### 5. Public selling introduction — first priority

Create a public landing page for selling, with a clear route into the signed-in submission form. One approach is `/sell-your-car` for the introduction while retaining `/sell` for the protected form.

1. A warm image of a real seller handover or team consultation.
2. The actual process: add details → upload photos/documents privately → staff review → agree any changes → publication when approved.
3. **“What affects your asking price?”** Condition, age, variant, kilometres driven, service information and comparable stock; no instant valuation promise.
4. A photo checklist and a category-specific document preparation guide.
5. Explain that the seller's expected price may be discussed and adjusted by staff after review; avoid implying that the form guarantees an offer or a sale.
6. Real seller experiences and specific FAQs when available.

Suggested SEO direction: sell a used car in Delhi NCR; sell a commercial vehicle through NCR Wheelz.

### 6. About — first priority

1. Replace illustration-only emphasis with a photo collage of the showroom, team and everyday work.
2. A factual founder/team story: why the business started, who helps customers and what the showroom actually does.
3. **“Meet the people behind your next drive.”** Names, roles and friendly portraits, approved by those featured.
4. A delivery wall or expanded customer stories. Replace the fictional fallback collection when authorised real material is ready.
5. A short behind-the-scenes film and dated milestones supported by records.

Do not invent years in business, vehicles sold, review scores, partnerships or awards. A small authentic team story is enough.

### 7. Contact — second priority

1. A recognisable exterior photograph showing the entrance/signboard.
2. A small visit gallery: entrance, customer seating and vehicle display area.
3. Practical travel/parking/landmark information verified by the team.
4. “What happens after you contact us?” with the actual follow-up process, without a response-time guarantee unless measured and supported.
5. A contextual call/directions/WhatsApp option if the approved business number and staffing support it. Existing form and map remain prominent.

### 8. Finance and EMI — second priority

Finance: replace the long plain-text presentation with clear cards for upfront costs, questions for a lender and preparation steps. Keep service claims aligned with the current absence of a configured lending partnership.

EMI: retain the existing calculator/chart and add a side-by-side scenario tool for different down payments or Loan tenure, a short worked example and simple term explanations. Keep user-entered assumptions visible; extra fees and running costs must not silently appear included.

Do not add partner logos, guaranteed approval, live rates or eligibility claims without an actual supported service.

### 9. Discounts — second priority

1. Campaign-specific artwork tied to genuine, current offers.
2. A small illustrated “How to ask about an offer” section using the existing offer enquiry flow.
3. Links to eligible vehicles only when that relationship is explicitly recorded; current offers do not automatically change vehicle prices.
4. A useful no-active-offers state with live inventory, a contact action and selected buying advice.

Use actual validity dates. Avoid timers or scarcity messages that restart or invent urgency.

### 10. Comparison — small enhancement only

Add short explanations for unfamiliar fields and an optional “What matters to you?” aid that helps readers compare space, upfront price, distance and fuel economy. Keep the existing comparison table/differences toggle central. Do not automatically declare the cheapest or lowest-distance car the best.

### 11. New buying guides — second phase

Start with a few useful articles, linked from the relevant pages:

- Buying a used car in Delhi NCR: a first-visit checklist.
- Kilometres driven vs mileage: what each number tells you.
- What to look for during a used-car test drive.
- How condition and service records affect an asking price.
- Choosing a used commercial vehicle: questions about load capacity and use.
- Preparing photos and information before listing your car.

Use original showroom photographs and input from the people doing the work. Include a real author/reviewer, publication/review date and sources where needed. Any current legal, registration, tax or finance guidance needs authoritative verification before publication and a maintenance owner.

Do not launch many near-identical city/brand/model pages. Later, create a few curated pages only when actual inventory and distinct useful content justify them. Existing filter URLs are deliberately not indexed; an indexable landing-page strategy would be a separate implementation decision.

## Customer slider specification

Working title: **New keys. Real stories.**

- Desktop: three visible photo cards; mobile: one full card with a glimpse of the next.
- Customer first name, vehicle, delivery month and a short approved quote.
- Swipe, previous/next buttons and optional expanded story/video.
- Optional slow auto-advance with a visible pause control; pause on hover/focus and respect reduced-motion preferences.
- Captions/transcript for video, useful alt text, keyboard access and reserved image space to avoid jumping layouts.
- Use a static small grid if there are too few real stories; do not duplicate three stories to imply a large customer base.
- Show a rating or review-source badge only when the source, score and permission support it.
- Place the compact version on Home and the fuller collection on About. Do not repeat it on every form or tool.

The current source content only supports name, quote and context. Photos, vehicle, dates, consent and media management would need explicit content-model/admin work if this is approved. A future content module should let staff draft, preview, publish, reorder and withdraw stories.

## Original draft copy direction

Homepage example:

> Your next car, closer to home. Explore used passenger cars and commercial vehicles with NCR Wheelz in Tilak Nagar, New Delhi. Compare your shortlist, ask our team about the details and request a test drive before deciding what fits.

Commercial introduction example:

> A vehicle for the work ahead. Explore the commercial vehicles currently listed with NCR Wheelz. Compare asking prices, kilometres driven and available load-capacity details, then speak to our team about the vehicle and your intended use.

Seller introduction example:

> Tell us about the vehicle you want to sell. Start with its details and your expected price, then add photos and supporting documents privately. Our team reviews the submission and follows up on any questions or changes before a listing is published.

These are original draft directions grounded in existing website behavior, not final approved business copy.

## Visual material to collect

| Material                | Initial useful set                                                        | Where it helps                  |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------- |
| Showroom photographs    | Exterior/entrance, wide interior, vehicle display and customer area       | Home, About, Contact            |
| Team photographs        | One group image and portraits for people who wish to be featured          | About, contact/team prompts     |
| Real delivery stories   | A small authorised set, ideally covering passenger and business customers | Home slider, About              |
| Real vehicle photo sets | Consistent exterior/interior/detail shots for current listings            | Inventory, details, collections |
| Short videos            | A showroom introduction and selected listing walkarounds                  | Home, About, vehicle details    |
| Practical guide imagery | Original examples of an odometer, tyres, cabin and photo angles           | Guides, selling introduction    |

Decorative illustrations can supplement real photos for concepts such as a buying journey. Generated or stock pictures should not be presented as actual NCR Wheelz customers, delivered vehicles or inspection evidence.

## SEO and delivery priorities

1. **First release:** homepage photography and discovery; About/team; real customer stories if assets are available; richer listing photography; public seller introduction.
2. **Second release:** differentiated passenger/commercial guidance, contact visit content and the first original buying guides.
3. **Third release:** car-finder questions, richer customer films and EMI scenario comparison, based on observed use and available content.

For each public page, use an accurate title/description, clear main heading, crawlable internal links and relevant original text. Keep important copy available as text rather than baked into artwork. Structured data must match visible supported facts; do not add ratings merely because sample testimonials exist. Keep image/video downloads light, load offscreen media on demand and avoid autoplay audio.

Measure browsing into real stock, saved vehicles, enquiry/test-drive completion, seller-form starts/completion and search impressions/clicks. Record a baseline before release; more scroll depth or more words alone is not a success measure.

Login/signup/password reset, account screens, saved vehicles, session restoration and admin pages do not need promotional sections or SEO text. Test-drive and enquiry forms benefit from a concise next-step explanation and contextual vehicle imagery rather than long marketing copy. Policies should remain readable and factual.
