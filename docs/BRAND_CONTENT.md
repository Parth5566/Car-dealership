# Brand content and original visuals — 25 October 2026

The homepage layout takes inspiration from [Spinny](https://www.spinny.com/): photo-led benefit cards, a Buy/Sell selector and a three-step illustrated process. All copy and artwork are original to this project. Benefits describe existing NCR Wheelz functions; no warranty, money-back guarantee, inspection certification, customer statistics or testimonials are asserted.

## Page placement

| Page                             | Added content                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                             | Buy/Sell benefit cards, keyboard-accessible tabs, three illustrated steps per mode, links to buying/selling/finance guides. Earlier illustrated journey cards retained. |
| Passenger cars                   | Budget, vehicle-history and visit preparation guide below inventory.                                                                                                    |
| Commercial vehicles              | Workload, operating-cost and applicable-paperwork guide below inventory.                                                                                                |
| About                            | Brand approach, original illustrative photography and useful tools; fictional testimonials removed.                                                                     |
| Contact                          | What to include when buying, selling or following up.                                                                                                                   |
| Selling guide (new public route) | Private-draft workflow, photo/document preparation, review steps and ownership-transfer preparation. Discoverable from home, footer, seller form and sitemap.           |
| Sell                             | Link to the public selling guide; account protection and submission workflow retained.                                                                                  |
| Finance                          | Loan terms, planning photography, lender preparation and relevant FAQs.                                                                                                 |
| EMI calculator                   | What-if guidance for down payment, loan tenure and costs outside EMI.                                                                                                   |
| Car valuation                    | Photo-led context on specification, history and individual condition. The previously removed range-calculation and comparable-price sections remain absent.             |
| Compare                          | How to build a useful shortlist and turn differences into questions.                                                                                                    |
| Vehicle details                  | Condition, documents and final-price checklist before a visit.                                                                                                          |

Private account/admin/authentication forms are not padded with marketing sections. Discounts retains its existing live campaign cards, terms and FAQs.

Guidance references primary sources where applicable: [Parivahan forms](https://parivahan.gov.in/parivahan/en/content/download-forms), [IRDAI motor insurance](https://irdai.gov.in/web/policy-holder/motor-insurance), and [RBI financial education](https://www.rbi.org.in/financialeducation/content/GUIDE310113_F.pdf). Current vehicle-specific transfer, insurance and loan terms must be confirmed with the responsible authority, insurer or lender.

## Assets and production

Tool: built-in `image_gen.imagegen`, generation mode (four new images, no input photographs). Generated originals remain in the image tool output directory. Project copies are optimized to 960 × 640 WebP with sharp, quality 84, and stored locally; there are no runtime third-party photo requests.

| Asset                | Saved project path                               |
| -------------------- | ------------------------------------------------ |
| Vehicle assessment   | `frontend/public/images/brand/inspection.webp`   |
| Parked car interior  | `frontend/public/images/brand/test-drive.webp`   |
| Budget planning      | `frontend/public/images/brand/planning.webp`     |
| Vehicle conversation | `frontend/public/images/brand/conversation.webp` |

Photography is illustrative, not real dealership staff or customer evidence. Captions and alt text identify this. The three process illustrations are original inline SVG in `frontend/components/process-art.tsx`, using the site's teal, sage and gold palette. Both image and SVG contact sheets were rendered and visually inspected. WebP files total approximately 315 KiB. Images have explicit dimensions and lazy loading; responsive CSS uses four/two photo columns and three/one process columns, with reduced-motion styling.

### Exact generation prompts

#### inspection

Use case: photorealistic-natural. Asset type: original editorial photograph for the NCR Wheelz automotive brand demo website, not a testimonial or photograph of actual customers/staff. Natural Indian setting, contemporary everyday car, premium but approachable, muted teal and warm sand/gold palette, soft daylight, genuine fabric and skin textures, professional editorial automotive photography. Landscape 3:2 composition suitable for cropping to a square card, key subject centred. No text, no logos, no watermarks, no visible licence-plate text, no celebrity likeness, no UI or graphic overlay.
Scene: A South Asian vehicle specialist in a plain muted teal work shirt, looking carefully into the open bonnet of a clean silver compact passenger car in an airy tidy garage. Three-quarter medium view, natural focused expression, realistic engine bay, professional equipment blurred behind. The bonnet and person should both be visible.

#### test-drive

Use case: photorealistic-natural. Asset type: original editorial photograph for the NCR Wheelz automotive brand demo website, not a testimonial or photograph of actual customers/staff. Natural Indian setting, contemporary everyday car, premium but approachable, muted teal and warm sand/gold palette, soft daylight, genuine fabric and skin textures, professional editorial automotive photography. Landscape 3:2 composition suitable for cropping to a square card, key subject centred. No text, no logos, no watermarks, no visible licence-plate text, no celebrity likeness, no UI or graphic overlay.
Scene: A young adult South Asian woman sitting comfortably in the driver seat of a modern unbranded compact car, viewed from the open front passenger-side doorway, hands naturally resting on the steering wheel, thoughtful relaxed smile, soft trees and Delhi-style urban greenery outside. Parked car, seatbelt visible, tasteful light interior.

#### planning

Use case: photorealistic-natural. Asset type: original editorial photograph for the NCR Wheelz automotive brand demo website, not a testimonial or photograph of actual customers/staff. Natural Indian setting, contemporary everyday car, premium but approachable, muted teal and warm sand/gold palette, soft daylight, genuine fabric and skin textures, professional editorial automotive photography. Landscape 3:2 composition suitable for cropping to a square card, key subject centred. No text, no logos, no watermarks, no visible licence-plate text, no celebrity likeness, no UI or graphic overlay.
Scene: A South Asian adult at a clean pale wood desk planning a car purchase, three-quarter close view of hands beside a simple calculator, pen, blank notebook and a small car key fob; subtle car silhouette through a showroom window softly out of focus. Calculator screen blank or indistinct. Warm natural light. No readable text or figures.

#### conversation

Use case: photorealistic-natural. Asset type: original editorial photograph for the NCR Wheelz automotive brand demo website, not a testimonial or photograph of actual customers/staff. Natural Indian setting, contemporary everyday car, premium but approachable, muted teal and warm sand/gold palette, soft daylight, genuine fabric and skin textures, professional editorial automotive photography. Landscape 3:2 composition suitable for cropping to a square card, key subject centred. No text, no logos, no watermarks, no visible licence-plate text, no celebrity likeness, no UI or graphic overlay.
Scene: Two South Asian adults in a relaxed consultation beside a clean unbranded silver hatchback outside a bright contemporary showroom. A woman buyer in warm neutral clothing and a man advisor in a plain muted teal shirt discuss a blank clipboard. Friendly conversational body language, no handshake or customer testimonial pose, natural expressions, landscaped neutral background.

## Validation

- `npm test`: 120 checks pass (65 backend, 55 frontend). New component regression exercises Buy/Sell content, selected/tab-stop state, keyboard focus and tab-to-panel associations.
- `npm run typecheck`: passes.
- `npm run build`: passes, including the new public selling guide.
- Server-render smoke checks pass for 15 guide/page fragments, 17 local image references and 44 internal links. About renders no sample testimonials.
- Browser workflow added for loaded photos, mode switching, keyboard control, mobile overflow and navigation to the public guide. Discovery passes. Execution was attempted but Chromium exits during startup before any browser workflow or QA database provisioning.
- HTTP suite includes the new public route and sitemap inclusion. Live HTTP execution is unavailable here because the environment rejects local listener binding with EPERM.
- No database records, credentials, provider configuration or external API usage changed by this content task.

For owner-host visual verification: `npm run test:browser -- --grep "homepage benefits"`, then inspect Home in Buy/Sell modes and the supporting pages at desktop and mobile widths.

## Dedicated homepage benefit photos — 25 October 2026

The benefit cards now use four new, exclusive photos so they do not repeat the lower homepage reading-card imagery. Both Buy and Sell views use this dedicated set. The existing reading/guide photos remain separate.

Mode: built-in `image_gen.imagegen`, new image generation, no input images. Project assets are optimized WebP copies at 960 × 640; original generated PNGs remain in the image tool output directory.

| Card visual                   | Saved project path                                  |
| ----------------------------- | --------------------------------------------------- |
| Tyre and wheel assessment     | `frontend/public/images/brand/benefit-details.webp` |
| Burgundy hatchback exterior   | `frontend/public/images/brand/benefit-drive.webp`   |
| Overhead budgeting still life | `frontend/public/images/brand/benefit-budget.webp`  |
| Showroom lounge conversation  | `frontend/public/images/brand/benefit-advice.webp`  |

The component's alternative text describes the new scenes. Layout, card copy, tab behaviour and destinations are unchanged. The existing homepage tab regression passes.

### Visible caption cleanup

At the owner's request, the “Illustrative brand photography” captions have been removed from the shared editorial guide and homepage benefits components, along with their unused CSS. This applies across every page consuming those components. A frontend-wide search found no other visible photography-production labels. Descriptive alternative text and asset provenance in this document remain available.

### Replacement prompt set

#### benefit-details

Use case: photorealistic-natural.
Asset type: dedicated NCR Wheelz homepage benefit-card photograph, illustrative automotive brand imagery.
Style: photorealistic editorial photography, approachable Indian setting, natural skin and fabric texture, soft daylight, muted teal, warm neutral and gold accents matching the website. Landscape 3:2 composition with a clearly centred subject that crops well to a near-square card.
Constraints: no text, logos, watermarks, readable number plates or UI overlays. Not an actual customer or staff testimonial. Visually distinct from generic open-bonnet, woman-in-driver-seat, man-at-desk and silver-car clipboard photos.
Scene: A South Asian female vehicle specialist wearing plain dark teal coveralls crouches beside the front wheel of a pearl-white compact SUV, inspecting its tyre tread and wheel with a small torch. Car bonnet closed. Side-on medium-close view in a bright clean service bay, the tyre and focused specialist both prominent, realistic natural body posture.

#### benefit-drive

Use case: photorealistic-natural.
Asset type: dedicated NCR Wheelz homepage benefit-card photograph, illustrative automotive brand imagery.
Style: photorealistic editorial photography, approachable Indian setting, natural skin and fabric texture, soft daylight, muted teal, warm neutral and gold accents matching the website. Landscape 3:2 composition with a clearly centred subject that crops well to a near-square card.
Constraints: no text, logos, watermarks, readable number plates or UI overlays. Not an actual customer or staff testimonial. Visually distinct from generic open-bonnet, woman-in-driver-seat, man-at-desk and silver-car clipboard photos.
Scene: A deep burgundy compact hatchback parked on a quiet tree-lined courtyard in Delhi NCR, car viewed three-quarter from outside. A South Asian adult man in a casual cream shirt stands beside the open driver door looking into the interior, preparing to explore the car. Parked vehicle, warm late-afternoon light, natural candid moment, exterior of car is the main subject.

#### benefit-budget

Use case: photorealistic-natural.
Asset type: dedicated NCR Wheelz homepage benefit-card photograph, illustrative automotive brand imagery.
Style: photorealistic editorial photography, approachable Indian setting, natural skin and fabric texture, soft daylight, muted teal, warm neutral and gold accents matching the website. Landscape 3:2 composition with a clearly centred subject that crops well to a near-square card.
Constraints: no text, logos, watermarks, readable number plates or UI overlays. Not an actual customer or staff testimonial. Visually distinct from generic open-bonnet, woman-in-driver-seat, man-at-desk and silver-car clipboard photos.
Scene: Clean top-down still-life photograph of a dark teal desk surface with a cream blank notebook, a simple unbranded calculator with indistinct screen, plain car key fob, pen and small tan leather wallet. Tasteful neatly spaced arrangement, warm sunlight and gentle shadows. No people, no money, no visible writing or numbers. A calm car-budget planning composition.

#### benefit-advice

Use case: photorealistic-natural.
Asset type: dedicated NCR Wheelz homepage benefit-card photograph, illustrative automotive brand imagery.
Style: photorealistic editorial photography, approachable Indian setting, natural skin and fabric texture, soft daylight, muted teal, warm neutral and gold accents matching the website. Landscape 3:2 composition with a clearly centred subject that crops well to a near-square card.
Constraints: no text, logos, watermarks, readable number plates or UI overlays. Not an actual customer or staff testimonial. Visually distinct from generic open-bonnet, woman-in-driver-seat, man-at-desk and silver-car clipboard photos.
Scene: A South Asian female car advisor in a plain teal blazer and a middle-aged South Asian male buyer in a light casual shirt seated across a small round wooden table in a bright showroom lounge, relaxed eye contact during a practical conversation. A dark blue passenger car softly out of focus behind glass. No clipboard, no handshake, no posing for the camera. Natural medium shot with both faces visible.
