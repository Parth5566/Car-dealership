export type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
  note?: string;
};
export type Policy = {
  title: string;
  shortTitle: string;
  description: string;
  category: string;
  summary: string[];
  sections: PolicySection[];
  related: string[];
};

export const policyUpdated = "25 October 2026";
export const policyOrder = [
  "terms",
  "privacy",
  "verification",
  "seller-agreement",
  "buyer-agreement",
  "condition",
  "cancellation-refund",
  "finance",
  "cookies",
];

export const policies: Record<string, Policy> = {
  terms: {
    title: "Terms & conditions",
    shortTitle: "Terms & conditions",
    category: "WEBSITE TERMS",
    description:
      "The terms for using NCR Wheelz, exploring vehicles and taking the next step with our team.",
    summary: [
      "Browsing, enquiries and valuations help you prepare for a vehicle discussion.",
      "An enquiry or test-drive request does not reserve or purchase a vehicle.",
      "Confirm the individual vehicle and final transaction terms before proceeding.",
    ],
    related: ["buyer-agreement", "seller-agreement", "privacy"],
    sections: [
      {
        id: "scope",
        title: "About these terms",
        paragraphs: [
          "These terms describe your use of the NCR Wheelz website and its account, listing, comparison, enquiry, test-drive request and valuation features. References to ‘we’, ‘us’ and ‘our’ mean NCR Wheelz; ‘you’ means the person using the website.",
          "Read these terms alongside the policy relevant to your activity. A vehicle purchase, sale, inspection, finance arrangement or ownership transfer may require a separate written agreement with the responsible party.",
        ],
      },
      {
        id: "eligibility",
        title: "Eligibility and authority",
        paragraphs: [
          "Use account and transaction-related services only if you can enter the relevant agreement under applicable law. When acting for a vehicle owner or business, you must have authority to provide the information and discuss the vehicle.",
          "Do not create an account using another person’s identity or provide their information without permission. Contact the team if a record has been submitted in your name without authority.",
        ],
      },
      {
        id: "accounts",
        title: "Your account and security",
        paragraphs: [
          "Provide accurate contact details and keep them current so we can respond to your requests. Keep your password private, sign out on shared devices and tell us promptly if you suspect unauthorised access.",
        ],
        points: [
          "Use your own account and do not share staff or customer credentials.",
          "Never send your password, recovery link or one-time security information through an enquiry.",
          "Use the password-reset flow if you lose access; account changes may require identity checks.",
        ],
      },
      {
        id: "listings",
        title: "Vehicle listings and availability",
        paragraphs: [
          "Listings describe vehicles using information supplied by sellers and authorised staff. Photographs, specifications, condition descriptions, kilometres driven, prices and availability should be checked for the individual vehicle.",
          "A published or reviewed listing is not a certificate of mechanical condition, ownership or document authenticity. A saved vehicle or comparison entry does not hold stock, and a listing may become unavailable or be updated.",
        ],
      },
      {
        id: "requests",
        title: "Enquiries and test-drive requests",
        paragraphs: [
          "Submitting an enquiry asks the team to contact you about your message. A test-drive request proposes a visit; the schedule is confirmed only when staff confirm it.",
          "A request, account registration or website response is not a vehicle purchase agreement. Confirm availability, timing, requirements and any separately agreed terms before travelling.",
        ],
      },
      {
        id: "prices",
        title: "Prices, offers and payments",
        paragraphs: [
          "Vehicle prices are displayed in Indian rupees. Confirm the final price and a breakdown of any applicable transfer costs, taxes, insurance, finance charges or other agreed amounts directly with the team.",
          "Offers apply only within their published eligibility, validity and terms. The website currently does not collect payments, deposits or booking fees. Any separately agreed payment needs its own written terms and receipt.",
        ],
      },
      {
        id: "tools",
        title: "Valuation, comparison and EMI tools",
        paragraphs: [
          "Comparison tools organise listing information; they do not inspect a vehicle. Car valuations provide indicative ranges using available similar advertised listings and may use broader matches or approximate bands when evidence is limited.",
          "A valuation is not a purchase offer, guaranteed selling price or completed-sale record. EMI results are planning calculations based on your inputs, excluding additional lender charges. Confirm finance terms with the lender.",
        ],
      },
      {
        id: "uploads",
        title: "Information and materials you submit",
        paragraphs: [
          "You are responsible for the accuracy of vehicle descriptions, contact details, photos and documents you submit, and for having permission to use them. Tell us about material errors or changes.",
          "You permit NCR Wheelz to store and use submitted material to operate the requested review and listing service, and to display approved vehicle information and photos if a listing is published. Supporting documents and private seller contact information are not public listing material.",
        ],
        points: [
          "Do not put identity numbers, contact details or financial information in public descriptions or photos.",
          "Do not upload Aadhaar, misleading documents, unlawful material or files that infringe another person’s rights.",
          "Read the privacy and document-review policies before uploading supporting records.",
        ],
      },
      {
        id: "acceptable-use",
        title: "Acceptable website use",
        paragraphs: [
          "Use the website for lawful vehicle-related activities and respect other users’ privacy and access.",
        ],
        points: [
          "Do not attempt to access another person’s account, private photos, documents or staff tools.",
          "Do not submit spam, threats, fraudulent offers, malicious files or deliberately misleading requests.",
          "Do not bypass access controls, disrupt availability or collect private data through automated requests.",
          "Report suspected security issues privately through the contact channels rather than exposing customer information.",
        ],
      },
      {
        id: "third-parties",
        title: "Third-party services and links",
        paragraphs: [
          "The website may use a map, external communication links and a market-data provider for vehicle catalogues and comparable listings. External services have their own terms, privacy practices and availability.",
          "A link or market-data reference does not create a partnership, endorsement or guarantee. Check external destinations before sharing information or making a payment.",
        ],
      },
      {
        id: "content-rights",
        title: "Website content and intellectual property",
        paragraphs: [
          "Website design, written content, artwork and branding are protected by the rights of their respective owners. You may view and use the site for its intended purpose; copying, reselling or presenting its content as your own requires the relevant permission.",
          "Vehicle manufacturers’ names identify vehicles and remain associated with their respective rights holders. They do not by themselves indicate an authorised dealership relationship.",
        ],
      },
      {
        id: "availability",
        title: "Corrections, interruptions and restricted access",
        paragraphs: [
          "Information may need correction, and maintenance, provider issues or network failures may interrupt features. Contact the team if an error affects a decision or you are uncertain whether a request was received.",
          "Access may be restricted to address misuse, fraud, security concerns or legal requirements. Restrictions do not remove rights you have under applicable law or automatically decide a separate vehicle dispute.",
        ],
      },
      {
        id: "responsibility",
        title: "Responsibility and your legal rights",
        paragraphs: [
          "Check information relevant to your decision and obtain appropriate independent inspection or advice where needed. A general website description does not settle responsibility for a particular transaction.",
          "Nothing in these policies excludes liability or consumer rights that cannot lawfully be excluded. Any dispute must be considered under applicable law and the written agreement relevant to the transaction; any complaint or remedy is subject to the requirements that apply to the parties and transaction.",
        ],
      },
      {
        id: "updates",
        title: "Updates and questions",
        paragraphs: [
          "We may update these pages to reflect changes to the website, services or requirements. The revision date appears at the top. Changes do not retrospectively rewrite a separately agreed transaction or remove rights already accrued.",
          "For a question or complaint, use the contact details at the end of this page and include the relevant listing, enquiry or submission reference. Do not include passwords or unnecessary identity documents.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    shortTitle: "Privacy",
    category: "YOUR INFORMATION",
    description:
      "What information the website handles, why it is needed and how to raise a privacy question.",
    summary: [
      "Account and request details support the services you choose to use.",
      "Seller documents and private contact details are kept separate from public listings.",
      "Contact the team for privacy requests; account export and deletion are not self-service features.",
    ],
    related: ["cookies", "verification", "terms"],
    sections: [
      {
        id: "scope",
        title: "Scope of this policy",
        paragraphs: [
          "This policy covers information handled through the NCR Wheelz website, including accounts, enquiries, test-drive requests, saved vehicles, seller submissions and supporting documents.",
          "If you follow an external link, use an external communication service or arrange a separate transaction, that service or arrangement may have additional privacy terms. This page describes the current website and the information associated with its features.",
        ],
      },
      {
        id: "account-data",
        title: "Account and contact information",
        paragraphs: [
          "When you create an account or contact us, the website may store your name, email address, phone number, account role and the contact details you choose to provide. Passwords are stored as hashes rather than readable passwords.",
          "We also record information needed to operate authentication, password recovery and consent, including relevant timestamps. Do not send a password or recovery token in a message to staff.",
        ],
      },
      {
        id: "request-data",
        title: "Enquiries, appointments and saved vehicles",
        paragraphs: [
          "We store the messages and vehicle references included in enquiries, and the requested time, contact details, notes and status of test-drive requests. Signed-in requests may be linked to your account.",
          "Your saved vehicles support your account shortlist. Comparison selections are stored in your browser. A consent record is retained with relevant request submissions so the context of your request can be understood.",
        ],
      },
      {
        id: "seller-data",
        title: "Vehicle submissions, photos and documents",
        paragraphs: [
          "Seller records include vehicle specifications, expected price, condition descriptions, seller contact details, photos, supporting files and review history. Document metadata can include file type, upload timing and review status.",
          "Submit only information you are authorised to share. Do not upload Aadhaar or include unnecessary identity, banking or contact information in photos and public descriptions. Use the submission checklist for the required documents.",
        ],
      },
      {
        id: "purposes",
        title: "Why we use this information",
        paragraphs: [
          "Information supports the feature or request you choose to use and the safe operation of the website.",
        ],
        points: [
          "Create and manage accounts, authentication and account recovery.",
          "Respond to enquiries and organise requested visits or test drives.",
          "Review seller submissions, request corrections and manage vehicle listings.",
          "Maintain request and review history, investigate errors and protect accounts.",
          "Meet applicable obligations and respond appropriately to disputes or lawful requests.",
        ],
      },
      {
        id: "public-private",
        title: "What can appear in a public listing",
        paragraphs: [
          "When staff publish a vehicle, its approved vehicle details and listing photos become publicly accessible. Public pages can be indexed, shared or copied by visitors and search engines.",
          "Supporting documents, private seller contact fields and private review records are restricted to authorised access rather than included in public listing responses. Remove personal information from vehicle photos before submitting them; information embedded in a photo may be visible if that photo is published.",
        ],
      },
      {
        id: "staff-access",
        title: "Staff access and operational records",
        paragraphs: [
          "Staff access is based on assigned roles and permissions. For example, a vehicle-publication task does not automatically grant access to private seller documents. Your account is limited to your own private records.",
          "The application records important staff actions, review decisions and protected document downloads for operational accountability. Access controls reduce exposure but no online system can promise absolute security.",
        ],
      },
      {
        id: "providers",
        title: "Service providers and external destinations",
        paragraphs: [
          "Vehicle catalogue and market-price features can obtain CarDekho listing data through Scrappa. These server-side searches use vehicle search details, such as a model or area, rather than sending your password or uploaded seller documents to the pricing provider.",
          "When form email notifications are enabled, enquiry, test-drive and submitted vehicle details are sent to the team’s designated receiving inboxes through Gmail. A separate acknowledgement is sent to the email address you provide. Delivery queue records retain the message and delivery status for retries; uploaded seller documents are not attached to these notifications.",
          "The Contact page can embed Google Maps. Loading a third-party embed may disclose technical connection information to that provider. Email, telephone and WhatsApp links open the service you choose; information sent there is also subject to that service’s practices.",
          "With your permission, Google Analytics collects information about website visits to help us understand use of the website. You can change that choice in Cookie preferences.",
        ],
      },
      {
        id: "security",
        title: "Storage and security measures",
        paragraphs: [
          "Authentication uses protected session cookies. Supporting documents are served through authorised download routes rather than public media URLs. Private photos have access restrictions while a submission remains private.",
          "Use a trusted device and network, protect your password and report suspected misuse promptly. Avoid putting sensitive records into a general enquiry. Technical controls do not replace careful handling of documents by the people authorised to access them.",
        ],
      },
      {
        id: "retention",
        title: "Retention and removing information",
        paragraphs: [
          "Account, enquiry, submission and audit records have different operational and record-keeping purposes. Retention depends on the service involved, unresolved requests, security needs and applicable obligations. Contact the team for information about a particular record.",
          "Removing a saved vehicle does not delete your account or previous enquiries. Taking a listing offline does not automatically erase its private submission or audit history. Backup copies and records that must be preserved may need separate handling.",
        ],
      },
      {
        id: "choices",
        title: "Your choices and privacy requests",
        paragraphs: [
          "You can update the profile details supported by your account and manage saved vehicles. Contact the team to ask about access, correction, withdrawal of a relevant consent or deletion of information, subject to applicable rights and record-keeping obligations.",
          "There is currently no self-service account export or complete erasure tool. A request may require proportionate verification to prevent another person accessing or deleting your records. Explain what you need without sending passwords or Aadhaar through the enquiry form.",
          "Withdrawing permission for a future contact does not itself cancel an agreed vehicle transaction or erase a record that must lawfully be retained.",
        ],
      },
      {
        id: "children",
        title: "Children and information about other people",
        paragraphs: [
          "The account and vehicle transaction features are intended for people able to use them lawfully. Do not submit a child’s personal information or another person’s documents unless you have the necessary authority and a valid reason.",
          "If information about a child or an unauthorised third party has been submitted, contact the team so the circumstances and appropriate action can be reviewed.",
        ],
      },
      {
        id: "concerns",
        title: "Privacy concerns and policy changes",
        paragraphs: [
          "Use the contact details below to raise a privacy concern. Include enough context to identify the request or record, and tell us your preferred contact method. The team can explain the next steps and any verification needed.",
          "We may revise this policy when data uses, providers or processes change. The revision date identifies the current wording. Rights and remedies available under applicable law remain available.",
        ],
      },
    ],
  },
  verification: {
    title: "Listing & document review",
    shortTitle: "Listing & document review",
    category: "LISTING STANDARDS",
    description:
      "How private submissions are reviewed, what each status means and what a review does—and does not—establish.",
    summary: [
      "Draft and submitted vehicle records stay private during review.",
      "Approval and public publication are separate staff actions.",
      "Manual review is a checklist process, not official verification or a mechanical certificate.",
    ],
    related: ["seller-agreement", "condition", "privacy"],
    sections: [
      {
        id: "scope",
        title: "Purpose of the review",
        paragraphs: [
          "The review helps staff assess whether the supplied vehicle information, photos and requested documents are sufficiently complete and consistent for the next listing step. It is a manual process.",
          "No government document-verification service or official title-check provider is connected to this application. A review status should not be presented as official certification.",
        ],
      },
      {
        id: "authority",
        title: "Seller authority and information quality",
        paragraphs: [
          "Submit a vehicle only if you own it or have authority from the owner to offer it. Keep the seller contact information current and disclose matters that affect the vehicle’s description, ownership or proposed sale.",
        ],
        points: [
          "Use the correct brand, model, variant, year, kilometres driven and expected price.",
          "Describe known defects, major repairs, relevant modifications and available service records accurately.",
          "Explain inconsistencies between the vehicle details and supporting documents instead of concealing them.",
        ],
      },
      {
        id: "checklist",
        title: "Document checklist",
        paragraphs: [
          "The passenger-vehicle checklist requests registration, ownership or authority evidence, insurance and pollution-under-control documentation. Commercial submissions also request fitness, permit and tax records.",
          "Loan-status, challan or other evidence may be relevant to the vehicle and circumstances. Follow the checklist in your submission and staff instructions, and check current statutory requirements with the relevant authority. Do not upload Aadhaar.",
        ],
      },
      {
        id: "files",
        title: "Photo and file requirements",
        paragraphs: [
          "Provide clear, legible files showing the relevant information. Vehicle photos should reflect the actual vehicle and any visible condition issues, rather than unrelated cars or misleading edits.",
        ],
        points: [
          "Use accepted formats and stay within the limits shown by the upload form.",
          "Avoid passwords, unrelated identity records and unnecessary third-party personal information.",
          "Do not place private document numbers or contact information in public vehicle photos.",
          "Keep your original records available for appropriate checks at a later stage.",
        ],
      },
      {
        id: "statuses",
        title: "What the submission statuses mean",
        paragraphs: [
          "Statuses describe progress through the website workflow rather than a guarantee about the vehicle.",
        ],
        points: [
          "Draft: information is being prepared and has not been submitted for review.",
          "Submitted or Under review: the vehicle is private while staff assess the record.",
          "Information Required: the seller is asked to correct or add information and resubmit the same record.",
          "Approved: the review has passed; the vehicle has not automatically gone live.",
          "Rejected: staff have declined the submission and recorded feedback.",
          "Published: authorised staff have separately made approved vehicle information and photos public.",
        ],
      },
      {
        id: "corrections",
        title: "Corrections, document replacements and resubmission",
        paragraphs: [
          "Sellers can edit a draft and respond when information is requested. A submitted record is locked for seller editing while the review is active. Use the existing submission to respond rather than creating duplicates to bypass a decision.",
          "Replacing a supporting document returns that document to a pending review state. Material changes to the vehicle details or photos can require fresh approval. A previous approval does not automatically cover later changes.",
        ],
      },
      {
        id: "staff-edits",
        title: "Authorised staff corrections",
        paragraphs: [
          "Authorised staff can correct vehicle specifications and an expected price during the review workflow. These changes are recorded in the review or audit history, and relevant approvals are cleared when details change.",
          "A corrected listing price is not, by itself, an agreed purchase price or permission to complete a sale. Contact the team if you disagree with a material correction or need to discuss the price.",
        ],
      },
      {
        id: "publication",
        title: "Publication and private access",
        paragraphs: [
          "Public listing data is limited to approved vehicle information and photos. Private seller contact information, supporting documents and restricted review records are not included in the public listing.",
          "Document access is restricted by account ownership and staff permission, and protected downloads are audited. Staff may remove a listing from public view when information changes, it becomes unavailable or further review is required.",
        ],
      },
      {
        id: "limits",
        title: "Limits of document review",
        paragraphs: [
          "Completeness and visual consistency checks do not prove that a document is genuine, current or sufficient for a transaction. Review does not establish legal title, clear finance, absence of theft or disputes, correct odometer history or roadworthiness.",
          "Buyers and sellers should check original records, applicable transport requirements and the individual vehicle before concluding a transaction. Consider independent professional assistance where appropriate.",
        ],
      },
      {
        id: "questions",
        title: "Questions, concerns and disputed records",
        paragraphs: [
          "Contact the team with the submission or listing reference if a record appears inaccurate, a document was uploaded without authority or you want an explanation of a review decision.",
          "Do not send additional private files through public messages or expose another person’s documents while raising a concern. The team can explain the appropriate channel and information needed.",
        ],
      },
    ],
  },
  "seller-agreement": {
    title: "Seller agreement",
    shortTitle: "Seller agreement",
    category: "SELLING WITH NCR WHEELZ",
    description:
      "Your responsibilities when preparing a vehicle submission, sharing documents and discussing a sale.",
    summary: [
      "You must own the vehicle or have permission to offer it.",
      "A private draft, review approval or listing is not an agreement to buy your vehicle.",
      "Price, payment, fees and handover terms must be confirmed separately.",
    ],
    related: ["verification", "privacy", "cancellation-refund"],
    sections: [
      {
        id: "scope",
        title: "What this agreement covers",
        paragraphs: [
          "This agreement covers using the website to submit a passenger or commercial cab for review and a possible listing. It should be read with the website terms, privacy policy and document-review policy.",
          "It does not appoint an exclusive sales agent, transfer ownership or require NCR Wheelz to buy the vehicle. Any such arrangement needs separately agreed written terms.",
        ],
      },
      {
        id: "authority",
        title: "Ownership and authority to sell",
        paragraphs: [
          "You confirm that you own the vehicle or have the owner’s authority to submit information and discuss its sale. Tell the team if a business, joint owner, lender or other party has an interest affecting the proposed sale.",
          "Do not use another person’s identity or offer a vehicle subject to restrictions you have not disclosed. Be ready to explain your authority through the appropriate document-review process.",
        ],
      },
      {
        id: "disclosure",
        title: "Accurate descriptions and material disclosures",
        paragraphs: [
          "Describe the actual vehicle rather than a different variant, a generic model specification or a condition you cannot support. Correct errors and notify the team when circumstances change.",
        ],
        points: [
          "Distinguish total kilometres driven from fuel economy or mileage.",
          "Disclose known defects, significant accident or repair history, modifications and relevant service information.",
          "Explain any odometer replacement, uncertainty or discrepancy you know about.",
          "Identify recorded finance, ownership disputes, commercial-use restrictions or other known obligations relevant to a sale.",
        ],
      },
      {
        id: "price",
        title: "Expected price and online valuation",
        paragraphs: [
          "Your expected price is a request for discussion. An online valuation is an indicative guide based on available data and may differ from an individual assessment, final asking price or agreed sale amount.",
          "Authorised staff may propose or record corrections to vehicle details and price during review. An updated website field does not itself mean you have accepted a binding offer; clarify material price changes with the team.",
        ],
      },
      {
        id: "materials",
        title: "Photos, documents and permission to use them",
        paragraphs: [
          "Supply photos and documents you are entitled to share. You permit us to use them for the requested review service and to display approved vehicle information and photos if the listing is published.",
          "Remove unnecessary personal items and private details from listing photos. Supporting documents are for restricted review, and you should not place their information in public descriptions. Do not upload Aadhaar.",
        ],
      },
      {
        id: "workflow",
        title: "Private drafts and manual review",
        paragraphs: [
          "Saving a draft keeps it private. Complete the required photos and document checklist, then submit for review. Staff can request information, approve or reject with recorded feedback.",
          "Approval and publication are separate. You can follow the record from your account and respond to an information request through the same submission. An approval does not guarantee publication, a buyer or a sale.",
        ],
      },
      {
        id: "availability",
        title: "Availability, inspections and visits",
        paragraphs: [
          "Tell the team promptly if the vehicle is sold, withdrawn, damaged or otherwise unavailable, or if its condition, ownership or price changes. Do not continue discussing availability you know is incorrect.",
          "Agree directly on inspection or visit arrangements. Keep keys and original records secure, and clarify who is authorised to view, drive or take custody of the vehicle. The website does not arrange automatic collection or delivery.",
        ],
      },
      {
        id: "fees",
        title: "Fees, payments and written offers",
        paragraphs: [
          "The website does not collect a listing payment, deposit or booking fee. Any proposed brokerage, inspection, transfer, transport or other charge must be explained and agreed separately in writing before the relevant service.",
          "A listing, valuation, review status or enquiry is not a payment instruction. Verify the recipient and agreed amount, and obtain an appropriate receipt for any separately arranged transaction.",
        ],
      },
      {
        id: "transfer",
        title: "Sale, finance clearance and handover",
        paragraphs: [
          "Before completing a sale, confirm the buyer, agreed price, payment arrangements, vehicle condition record and responsibilities for registration and insurance transfer. Address recorded finance and any required lender release with the lender.",
          "Transport-authority and insurer procedures vary with the transaction. Agree who will submit documents, pay applicable charges and retain acknowledgements; a website status update does not complete legal transfer.",
        ],
      },
      {
        id: "withdrawal",
        title: "Changes, withdrawal and removal requests",
        paragraphs: [
          "Contact the team with your submission reference if you want to withdraw a vehicle or request removal of a public listing. Do not assume editing or deleting a browser entry removes the underlying submission.",
          "Removal from public view is separate from deleting private review history, audit records or records that must be retained. A separately signed transaction may have its own cancellation terms.",
        ],
      },
      {
        id: "concerns",
        title: "Concerns and your rights",
        paragraphs: [
          "Raise inaccurate details, unauthorised changes or disputed records with the team and keep copies of relevant communications. Do not send passwords or unrequested identity documents when asking for help.",
          "These website terms do not remove non-excludable rights or replace a separately agreed vehicle-sale contract.",
        ],
      },
    ],
  },
  "buyer-agreement": {
    title: "Buyer & customer agreement",
    shortTitle: "Buyer agreement",
    category: "BUYING WITH NCR WHEELZ",
    description:
      "A clear guide to enquiries, test drives and the checks and written terms needed before buying a vehicle.",
    summary: [
      "Enquiries and saved vehicles do not reserve stock.",
      "A requested test drive needs staff confirmation.",
      "Inspect the vehicle and confirm the final price, documents and sale terms.",
    ],
    related: ["condition", "cancellation-refund", "finance"],
    sections: [
      {
        id: "scope",
        title: "Using the buying features",
        paragraphs: [
          "You can browse available listings, compare vehicles and explore valuation and EMI tools without a purchase commitment. Some features, including saved vehicles and test-drive requests, use an account.",
          "These terms cover website interactions. A vehicle purchase is a separate transaction requiring agreed terms with the responsible seller or business.",
        ],
      },
      {
        id: "information",
        title: "Your information and communication",
        paragraphs: [
          "Provide accurate contact details and a clear message about the vehicle or assistance you need. Use the reference shown for a submitted request when following up.",
          "Contact details submitted for a request support responding to that request. Do not use enquiries to send unrelated promotions, another person’s private records or payment credentials.",
        ],
      },
      {
        id: "availability",
        title: "Availability and shortlists",
        paragraphs: [
          "A vehicle can be sold, reserved, updated or removed after you first view it. Saving or comparing it does not reserve it, freeze its price or require a seller to complete a transaction.",
          "Confirm the exact vehicle and current availability before travelling. A comparison highlights listing fields and does not replace an individual assessment.",
        ],
      },
      {
        id: "test-drives",
        title: "Test-drive requests and confirmation",
        paragraphs: [
          "Submitting a preferred time creates a request. Staff must confirm the appointment, vehicle and practical arrangements before it is treated as scheduled.",
          "Ask about the location, driving-licence requirements, authorised drivers, route, insurance arrangements and any vehicle-specific restrictions. Do not drive unless you are legally entitled and the responsible party has authorised it.",
        ],
      },
      {
        id: "visits",
        title: "Visits, safety and changes of plan",
        paragraphs: [
          "Arrive at the agreed location and follow lawful safety instructions. Check that any proposed road use is appropriate for the vehicle and your licence, particularly for commercial cabs.",
          "If your plans change, contact the team as early as possible with the request reference. A schedule change does not automatically cancel a separate written sale agreement.",
        ],
      },
      {
        id: "inspection",
        title: "Condition and independent inspection",
        paragraphs: [
          "Inspect the vehicle’s bodywork, tyres, cabin, equipment and operation, and ask about service history, repairs, known defects and modifications. Consider an independent mechanical assessment where appropriate.",
          "Photos and descriptions cannot reveal every defect or guarantee future performance. Ask for important condition statements and any agreed repair work in writing before proceeding.",
        ],
      },
      {
        id: "documents",
        title: "Documents, ownership and outstanding obligations",
        paragraphs: [
          "Check the registration, identity and authority of the seller, insurance, available service records and any recorded finance. Commercial cabs may have additional permit, fitness or tax requirements.",
          "Review original records and applicable authority requirements. Manual listing review is not proof of title, authenticity, liability clearance or fitness for your intended use.",
        ],
      },
      {
        id: "price",
        title: "Final price and payment terms",
        paragraphs: [
          "Confirm the agreed vehicle price and the treatment of any taxes, transfer charges, insurance, finance costs or other amounts. Check the exact eligibility and expiry of any offer.",
          "The website does not collect payments or booking deposits. For any separate payment, verify the recipient, purpose, written terms and receipt. A valuation range is not a binding purchase price.",
        ],
      },
      {
        id: "finance-warranty",
        title: "Finance and warranty discussions",
        paragraphs: [
          "Loan eligibility, interest, fees and repayment terms are decided by the lender. The EMI calculator does not approve finance and excludes additional charges.",
          "No automatic NCR Wheelz warranty, money-back period or manufacturer coverage is created by a listing. Any vehicle-specific cover must be confirmed in writing, including its provider, scope and exclusions. Applicable consumer rights remain unaffected.",
        ],
      },
      {
        id: "handover",
        title: "Purchase agreement and handover",
        paragraphs: [
          "Before completing a transaction, record the parties, vehicle identity, agreed price, payment record, condition, included items and responsibilities for transfer and handover.",
          "Agree on original documents, keys, insurance arrangements, finance release and required authority procedures. A website request or listing status does not itself transfer ownership.",
        ],
      },
      {
        id: "complaints",
        title: "Questions, complaints and legal rights",
        paragraphs: [
          "Use the contact details below for an issue with a request or listing, including the vehicle or request reference and relevant facts. Keep communications and transaction records.",
          "Nothing in this agreement removes rights or remedies that cannot lawfully be excluded. Any specific sale or cancellation issue also depends on the applicable law and the separate transaction terms.",
        ],
      },
    ],
  },
  condition: {
    title: "Vehicle condition disclaimer",
    shortTitle: "Vehicle condition",
    category: "KNOW WHAT YOU ARE BUYING",
    description:
      "How to interpret listing descriptions, photos, review statuses and any vehicle-specific warranty statements.",
    summary: [
      "Used vehicles need an individual condition and history assessment.",
      "Document review does not certify roadworthiness or clear title.",
      "Any specific warranty or repair commitment needs written confirmation.",
    ],
    related: ["buyer-agreement", "verification", "terms"],
    sections: [
      {
        id: "scope",
        title: "Information about an individual used vehicle",
        paragraphs: [
          "A used vehicle’s condition reflects its age, use, maintenance, repairs and storage. Listing information helps you shortlist but cannot describe every aspect of the actual vehicle or predict future performance.",
          "Read the listing as a description to check rather than an independent inspection report. Ask the team to clarify anything material before you decide.",
        ],
      },
      {
        id: "photos",
        title: "Photos and visible appearance",
        paragraphs: [
          "Lighting, camera angle, reflections and screen settings can affect how colour and surface condition appear. A photo may not show wear, hidden damage or a mechanical concern.",
          "Confirm which photos relate to the actual vehicle. General website artwork and lifestyle imagery are separate from the vehicle’s listing photos; sample inventory, when displayed for testing, is identified as such.",
        ],
      },
      {
        id: "specifications",
        title: "Specifications and fitted equipment",
        paragraphs: [
          "Features can differ by model year, variant, market specification and later modification. Confirm the equipment fitted to the individual vehicle rather than relying solely on a general model description.",
          "Check operation as well as presence: for example, lights, air conditioning, safety equipment, electronics, locks and accessories. Raise missing or inconsistent information before proceeding.",
        ],
      },
      {
        id: "distance",
        title: "Kilometres driven, mileage and history",
        paragraphs: [
          "Kilometres driven refers to the odometer reading supplied for the listing. Mileage or fuel economy refers to consumption, such as kilometres per litre, and is a different measure.",
          "Review available service and ownership records and ask about odometer replacements or uncertainties. A displayed reading does not independently establish the complete distance history, and fuel economy varies with use and conditions.",
        ],
      },
      {
        id: "mechanical",
        title: "Mechanical condition and inspection",
        paragraphs: [
          "Consider engine and transmission operation, tyres, brakes, steering, suspension, bodywork and signs of corrosion, leaks or previous repair. Electric and hybrid vehicles can require specialist battery and high-voltage assessment.",
          "Use a qualified independent assessor where appropriate. A short test drive, uploaded document or website review is not a comprehensive mechanical inspection or a guarantee against later faults.",
        ],
      },
      {
        id: "disclosures",
        title: "Known issues, repairs and modifications",
        paragraphs: [
          "Ask about significant damage, repairs, recurring faults, modifications and maintenance needs. Sellers are expected to provide accurate information and disclose known matters relevant to the proposed sale.",
          "Record important representations, agreed repairs and unresolved issues in the transaction documents. Clarify who will carry out work, what is included and how completion will be checked.",
        ],
      },
      {
        id: "legal-use",
        title: "Roadworthiness and suitability for use",
        paragraphs: [
          "Check that the vehicle meets the registration, insurance and use requirements applicable to your plans. A commercial cab may require additional fitness, permit or tax records and restrictions may vary by vehicle or location.",
          "Confirm permitted passenger use, seating and other relevant requirements with the responsible authority or professional. Publication on the website does not grant permission to use a vehicle on a road or for a particular business.",
        ],
      },
      {
        id: "review",
        title: "What manual review establishes",
        paragraphs: [
          "The listing review checks submitted information and a document checklist. It is not official verification of authenticity, legal title, absence of finance, accident history or mechanical condition.",
          "An Approved or Published status describes the website workflow. It does not create an inspection certificate or replace checks needed for the individual transaction.",
        ],
      },
      {
        id: "warranty",
        title: "Warranty and vehicle-specific promises",
        paragraphs: [
          "The application does not provide a blanket marketplace warranty, fixed return period or automatic repair cover. A manufacturer or other provider may have vehicle-specific terms that require separate confirmation.",
          "If cover is offered, obtain the provider, duration or distance limit, covered items, exclusions, claim process and any service obligations in writing. Do not infer cover from photographs, review status or general brand content.",
        ],
      },
      {
        id: "rights",
        title: "Errors, concerns and consumer rights",
        paragraphs: [
          "Report an inaccurate listing or material condition concern with the listing reference and relevant details. Avoid driving a vehicle you believe is unsafe and seek appropriate professional assistance.",
          "This disclaimer explains the limits of website information; it does not exclude rights or responsibility that cannot lawfully be excluded or override a written vehicle-specific commitment.",
        ],
      },
    ],
  },
  "cancellation-refund": {
    title: "Cancellation & refund policy",
    shortTitle: "Cancellations & refunds",
    category: "REQUESTS & PAYMENTS",
    description:
      "What cancellation means for a free website request and where separately agreed payment or sale terms apply.",
    summary: [
      "No payments, deposits or paid bookings are collected on this website.",
      "Contact the team to change a visit, enquiry or seller listing request.",
      "Any separate payment or purchase needs its own written cancellation and refund terms.",
    ],
    related: ["buyer-agreement", "seller-agreement", "terms"],
    sections: [
      {
        id: "current-service",
        title: "Current website services",
        paragraphs: [
          "The website currently accepts enquiries, free test-drive requests and private seller submissions. It does not provide an online checkout or collect booking fees, deposits, purchase payments or finance repayments.",
          "Submitting one of these requests does not create a paid booking or a completed vehicle sale. There is no website payment to refund when you change a free request.",
        ],
      },
      {
        id: "enquiries",
        title: "Changing or closing an enquiry",
        paragraphs: [
          "Contact the team if you no longer need assistance or want to correct an enquiry. Include the reference and enough contact information to locate your request.",
          "Closing an enquiry is separate from deleting its record or withdrawing from a transaction agreed elsewhere. Privacy requests are handled under the privacy policy.",
        ],
      },
      {
        id: "test-drives",
        title: "Test-drive changes and cancellations",
        paragraphs: [
          "A requested time needs staff confirmation. If you need to change or cancel it, contact the team promptly with the appointment reference, vehicle and planned time.",
          "The team may also need to change a visit because the vehicle becomes unavailable, conditions are unsuitable or another practical issue arises. Confirm revised arrangements before travelling. This website does not impose an automatic cancellation fee for its free requests.",
        ],
      },
      {
        id: "seller-withdrawal",
        title: "Withdrawing a seller submission or listing",
        paragraphs: [
          "Ask the team to withdraw a submission or take a listing offline if you no longer want to proceed. Tell us promptly if the vehicle is sold elsewhere or becomes unavailable.",
          "Public removal does not automatically erase private submissions, supporting records or audit history. A separate signed selling or agency arrangement, if any, may contain additional withdrawal terms.",
        ],
      },
      {
        id: "separate-payments",
        title: "Payments agreed outside the website",
        paragraphs: [
          "If you agree a deposit, inspection charge, purchase payment or other service separately, obtain the applicable written terms before paying. Those terms should identify the recipient, purpose, amount and any conditions affecting cancellation or refund.",
          "Do not assume a generic website statement creates a refundable deposit, a cooling-off period or a money-back guarantee. Any entitlement also depends on applicable law and the facts of the transaction.",
        ],
      },
      {
        id: "refund-requests",
        title: "Raising a payment or refund concern",
        paragraphs: [
          "For an amount you believe was paid to NCR Wheelz, contact the team with the transaction date, amount, receipt or reference and reason for the request. Do not send full card numbers, banking passwords or one-time codes.",
          "The team must identify the transaction and relevant agreement before a refund decision can be made. Any refund entitlement, timing and method depend on the applicable agreement, payment arrangements and legal requirements.",
        ],
      },
      {
        id: "third-parties",
        title: "Third-party finance and other services",
        paragraphs: [
          "Lender repayments, insurance premiums, transport-authority charges and independent service payments are governed by the relevant provider and applicable requirements. Contact the responsible provider about its cancellation or refund process.",
          "An external link on this website does not make NCR Wheelz the recipient of that provider’s payment or give the website authority to reverse it.",
        ],
      },
      {
        id: "future-services",
        title: "If online payments are introduced",
        paragraphs: [
          "Before accepting a new type of paid booking or online payment, the relevant payment, cancellation and refund terms must be made available for that service. They should explain the charge, confirmation, cancellation conditions and how a refund request is handled.",
          "Existing written agreements and non-excludable rights are not retrospectively changed by a later website update.",
        ],
      },
      {
        id: "rights",
        title: "Complaints and legal rights",
        paragraphs: [
          "Keep transaction records and contact the team if you believe a payment instruction, cancellation decision or listing is incorrect. Explain the outcome you are seeking and include the relevant reference.",
          "Nothing in this policy removes a refund, remedy or consumer right that applies under law. A particular dispute must be assessed against its agreement and circumstances.",
        ],
      },
    ],
  },
  finance: {
    title: "Finance disclaimer",
    shortTitle: "Finance information",
    category: "PLAN WITH CONTEXT",
    description:
      "The limits of EMI estimates, loan information and any discussion of vehicle financing.",
    summary: [
      "EMI results are estimates based on the inputs you choose.",
      "No lender application service or guaranteed approval is configured.",
      "Confirm eligibility, charges and total repayment with your chosen lender.",
    ],
    related: ["buyer-agreement", "terms", "privacy"],
    sections: [
      {
        id: "purpose",
        title: "General planning information",
        paragraphs: [
          "Finance content and calculators help you explore a possible budget. They do not assess your personal financial position, recommend a particular loan or replace advice appropriate to your circumstances.",
          "No lender partnership or application service is currently configured on the website. NCR Wheelz does not promise finance approval, a particular rate or a particular lender outcome.",
        ],
      },
      {
        id: "inputs",
        title: "Calculator inputs and method",
        paragraphs: [
          "The EMI calculator uses the vehicle price, down payment, annual interest rate and loan tenure you enter. The loan amount is the price less the down payment, and the calculation uses a monthly reducing-balance formula.",
          "At zero interest, the amount borrowed is divided across the repayment months. Invalid or inconsistent inputs need correction before the estimate is useful.",
        ],
      },
      {
        id: "limits",
        title: "What the estimate excludes",
        paragraphs: [
          "The calculation covers the entered loan principal and calculated interest rather than every cost of a financed purchase.",
        ],
        points: [
          "Processing, documentation, late-payment or early-repayment charges.",
          "Insurance, taxes, transfer costs and optional products.",
          "Lender-specific interest conventions, variable-rate changes or revised schedules.",
          "Differences caused by rounding, disbursement dates or a lender’s actual agreement.",
        ],
      },
      {
        id: "eligibility",
        title: "Eligibility and lender decisions",
        paragraphs: [
          "The lender sets eligibility criteria, vehicle restrictions, document requirements, interest and other terms. An advertised vehicle price or a calculator result is not a sanction letter or lending commitment.",
          "Ask the lender about factors relevant to the individual application and vehicle. Do not treat an informal conversation as final approval.",
        ],
      },
      {
        id: "comparison",
        title: "Compare the complete borrowing cost",
        paragraphs: [
          "Compare the amount borrowed, down payment, interest rate, loan tenure, charges and total repayment. For the same amount and rate, a longer tenure can reduce the monthly EMI while increasing total interest.",
          "Include running costs and maintenance in your budget. Confirm a written repayment schedule and terms directly with the lender before accepting a loan.",
        ],
      },
      {
        id: "documents",
        title: "Documents and sensitive information",
        paragraphs: [
          "Ask your chosen lender for its document checklist and authorised submission channel. The website’s vehicle-document review is not a lender application or credit assessment.",
          "Do not upload Aadhaar, banking passwords, full card details or recovery codes through NCR Wheelz enquiry forms. Read the lender’s privacy and security information before sharing sensitive records.",
        ],
      },
      {
        id: "agreements",
        title: "Separate finance and vehicle agreements",
        paragraphs: [
          "A finance decision and a vehicle purchase are related but separate arrangements. Confirm what happens if finance is declined, delayed or offered on different terms before committing to a purchase or paying any separately agreed deposit.",
          "Repayment obligations, cancellation, insurance and lender fees are governed by the actual finance agreement and applicable law.",
        ],
      },
      {
        id: "questions",
        title: "Questions and corrections",
        paragraphs: [
          "Contact the team about a website calculator error, including the inputs and result you saw. Direct questions about an actual loan, statement or repayment to the responsible lender.",
          "This disclaimer does not remove rights or obligations that cannot lawfully be excluded.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies & preferences",
    shortTitle: "Cookies & preferences",
    category: "BROWSER STORAGE",
    description:
      "How sign-in cookies, comparison selections and storage preferences support the website.",
    summary: [
      "Essential cookies support sign-in and account security.",
      "Comparison choices and your storage preference are kept in your browser.",
      "Google Analytics is optional and loads when you allow it.",
    ],
    related: ["privacy", "terms", "cancellation-refund"],
    sections: [
      {
        id: "purpose",
        title: "Cookies and browser storage",
        paragraphs: [
          "Cookies are small values a browser sends with relevant website requests. Other storage, such as local storage and IndexedDB, can keep preferences or coordinate website features on your device.",
          "The website uses these mechanisms for the specific functions described below. This policy should be read with the privacy policy.",
        ],
      },
      {
        id: "sessions",
        title: "Essential sign-in cookies",
        paragraphs: [
          "The nw_access and nw_refresh cookies support authenticated access and session renewal. They use HttpOnly and SameSite protections, and production secure cookies require HTTPS.",
          "Sessions can expire, be revoked on logout or be invalidated for security reasons. Blocking these cookies can prevent account, saved-vehicle, seller and staff features from working.",
        ],
      },
      {
        id: "comparison",
        title: "Comparison and preference storage",
        paragraphs: [
          "The nw_compare local-storage entry keeps selected vehicle IDs for comparison. The nw_cookie_preferences entry records your analytics choice in that browser.",
          "Clearing browser data can remove those choices. These settings are device- and browser-specific and do not automatically change settings on another device.",
        ],
      },
      {
        id: "coordination",
        title: "Session coordination between tabs",
        paragraphs: [
          "The website can use browser locking or an IndexedDB entry to coordinate session renewal between tabs. This helps prevent overlapping refresh attempts from disrupting a shared session.",
          "This coordination is an account-security function, not a behavioural advertising profile. Storage restrictions can affect its availability.",
        ],
      },
      {
        id: "optional",
        title: "Analytics, marketing and external services",
        paragraphs: [
          "If you allow analytics, Google Analytics uses cookies and collects information about website visits. Analytics is not loaded before you allow it.",
          "Google Maps and external sites opened from links can have their own storage and privacy practices. This browser preference does not control third-party websites or settings outside NCR Wheelz.",
        ],
      },
      {
        id: "controls",
        title: "Your browser controls",
        paragraphs: [
          "You can clear or block cookies and site storage through your browser, and sign out to end your current account session. Some essential features may stop working if their storage is blocked.",
          "The control below lets you allow analytics or choose essential storage only. If it cannot save the choice, the page explains that limitation.",
        ],
      },
      {
        id: "updates",
        title: "Changes and questions",
        paragraphs: [
          "If new optional tracking or service integrations are introduced, their purposes and controls should be reflected in this policy before use. The revision date identifies the current wording.",
          "Use the contact details below if you have a question about browser storage or a related privacy concern.",
        ],
      },
    ],
  },
};

export function getPolicy(slug: string): Policy | undefined {
  return Object.hasOwn(policies, slug) ? policies[slug] : undefined;
}

export function policyReadingMinutes(policy: Policy) {
  const words = [
    policy.description,
    ...policy.summary,
    ...policy.sections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
      ...(section.points || []),
      section.note || "",
    ]),
  ]
    .join(" ")
    .trim()
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
