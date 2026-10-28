# Policy pages — 25 October 2026

## Design and reference status

All nine existing `/policies/[slug]` routes now use a shared policy-document layout: teal header, breadcrumb, revision date, calculated reading time, concise summary, white document panel, numbered sections, desktop contents navigation, related policies and configured contact details. Mobile uses native collapsible contents and a separate all-policies link group. Section anchors allow for the fixed website header; document styles include a print treatment.

The requested reference was `https://websnexa.netlify.app/terms-and-conditions`, with its refund page as a second reference. Both URLs and the site root were unavailable through the web reader; a direct request could not resolve the domain. Native browser access was unavailable. The owner then identified `Screen Recording 2026-10-25 at 8.43.45 PM.mov`; the matching recording was located on the Desktop. AVFoundation, an explicit software decoder and the available media tooling could not extract its frames. Consequently **the reference's appearance and wording have not been verified**, and this layout is a project-consistent provisional design rather than a claimed visual match. Still screenshots would allow an accurate comparison and adjustment.

## Content

| Route                           | Sections | Main coverage                                                                                                                                                       |
| ------------------------------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/policies/terms`               |       14 | Website scope, authority, accounts, listings, requests, prices, uploads, tools, acceptable use, providers, content rights, interruptions, legal rights and updates. |
| `/policies/privacy`             |       13 | Account/request/seller information, purposes, public/private separation, staff access, providers, security, retention, privacy requests and concerns.               |
| `/policies/verification`        |       10 | Seller authority, document checklist, files, statuses, corrections, staff edits, publication, review limitations and disputes.                                      |
| `/policies/seller-agreement`    |       11 | Authority, disclosures, expected price, materials, review, availability, fees, transfer, withdrawal and concerns.                                                   |
| `/policies/buyer-agreement`     |       11 | Buying features, requests, availability, driving arrangements, inspection, documents, price, finance/warranty and handover.                                         |
| `/policies/condition`           |       10 | Individual condition, photos, equipment, odometer/fuel economy, assessment, repairs, lawful use, review limits and written warranty terms.                          |
| `/policies/cancellation-refund` |        9 | Free requests, enquiry/test-drive changes, seller withdrawal, separate payments, refund concerns, third-party payments and rights.                                  |
| `/policies/finance`             |        8 | Planning purpose, inputs, excluded charges, lender decisions, total cost, sensitive documents and separate agreements.                                              |
| `/policies/cookies`             |        7 | Session cookies, local storage, tab coordination, optional services, browser controls and existing preference control.                                              |

Total: **93 sections**, approximately 5,646 body words. Content is centralised in `frontend/lib/policies.ts`; the shared renderer and styles are in `frontend/components/policy-document.tsx` and its CSS module.

Outdated wording saying all third-party integrations were disabled was corrected. The privacy page describes the current Scrappa/CarDekho market-data requests and the Google Maps embed. No new third-party requests or provider credits were used for this work. The text reflects the current absence of website checkout, paid bookings, lender applications, official document verification, blanket warranty and automatic return promises. Original cookie preference behaviour is retained.

These remain **draft website policies for business/legal review**, with the existing no-index status retained. No legal compliance certification is asserted. Business legal identity, record-specific retention procedures, an approved privacy/grievance handling process and any separate paid-service/sale/warranty terms still require the operator's confirmation before use in a live commercial service. The general business contact is used; no officer, deadline, licence, return window, fee or jurisdiction clause has been fabricated.

## Sources checked

Primary references were used to check the relevant subject areas; the pages use original website-specific wording and avoid quoting legislation or claiming fixed statutory deadlines:

- [MeitY: Act and Policies](https://www.meity.gov.in/documents/act-and-policies?page=1) — current data-protection framework publications; no unverified claim that every provision is in force.
- [Consumer Protection (E-Commerce) Rules, 2020, government-hosted text](https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20%28E-Commerce%29%20Rules%2C%202020.pdf) — consumer/marketplace obligations and preserving applicable remedies.
- [Parivahan: transfer of ownership](https://mparivahan.parivahan.gov.in/mstatic/english/rc-info-ownership.html) — vehicle-specific transfer procedures and supporting documents.
- [IRDAI: motor insurance](https://irdai.gov.in/web/policy-holder/motor-insurance) — insurer involvement and vehicle ownership/insurance records.

## Validation

- TypeScript and webpack production build pass.
- All 55 existing frontend source checks pass.
- Server-render smoke checks cover all nine documents, 93 section anchors, unique IDs, cross-policy destinations, configured contact overrides and cookie-control placement.
- Unknown and prototype-property slugs (`__proto__`, `constructor`, `toString`) are rejected by the new policy lookup.
- HTTP coverage includes all nine policy routes. A browser workflow covers desktop contents links, policy navigation, mobile contents/overflow, cookie preference persistence and unknown-route 404s.
- Browser execution was attempted; the installed Chromium exits during startup before the workflow can run. Final rendered-page visual acceptance remains pending on the owner host.
- No authentication, consent-version, database, payment, upload-access or transaction behaviour was changed.

Owner-host check: `npm run test:browser -- --grep "policy documents"`.

## Owner feedback: typography

The owner accepted the current Terms/Privacy design and requested larger, more readable text. Shared policy body text is now 18px on desktop and 17px on mobile, with darker text and 1.85 line height. Section headings, summaries, contents links, contact details, cookie preference controls and secondary notes have also been enlarged. The page structure and wording are unchanged. The reported Cookies error disappeared on the owner's next check, and the owner explicitly narrowed this follow-up to typography; no cookie behaviour was modified.

After reviewing the larger type, the owner requested a slightly smaller text scale. The final body size is 17px on desktop and 16px on mobile, with 1.75 line height and 13px paragraph spacing. Headings, summaries and contents links were reduced proportionally while retaining the darker text colour.
