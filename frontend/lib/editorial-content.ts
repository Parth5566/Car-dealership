export type GuideContent = {
  eyebrow: string;
  title: string;
  intro: string;
  image?: string;
  alt?: string;
  items: { title: string; text: string }[];
  links: { label: string; href: string }[];
  resource?: { label: string; href: string };
};
export const guides = {
  selling: {
    eyebrow: "FROM FIRST DETAILS TO A REVIEW",
    title: "Sell your vehicle, one clear step at a time.",
    intro:
      "You can prepare before signing in. Gather the details, photograph the vehicle as it is and think about the questions a buyer would ask. When you are ready, start a private draft and complete the checklist in your account.",
    image: "inspection",
    alt: "Illustrative specialist checking a car before a discussion about its condition",
    items: [
      {
        title: "Start with the essentials",
        text: "Keep the brand, model, variant, manufacturing year, fuel, transmission and owner count ready. Read the odometer for kilometres driven. Describe the condition, service history and known issues clearly.",
      },
      {
        title: "Consider your expected price",
        text: "Try the car valuation tool for an indicative starting point, then enter your expected price in the draft. An online range is a guide; an individual review and discussion determine any agreed price.",
      },
      {
        title: "Add useful photos and documents",
        text: "Show the front, rear, both sides, cabin and any visible damage in good light. Avoid personal items and unnecessary personal information in photos. Follow the document checklist shown for your vehicle category; do not upload Aadhaar.",
      },
      {
        title: "Submit and follow the review",
        text: "Saving a draft does not make it public. When the checklist is complete, submit it for manual review. Track updates in your account and respond if the team requests more information. Approval does not automatically publish a listing.",
      },
    ],
    links: [
      { label: "Start a private draft", href: "/sell" },
      { label: "Check an indicative car value", href: "/car-valuation" },
      { label: "Ask the team a question", href: "/contact" },
    ],
  },
  about: {
    eyebrow: "LIFE, WORK AND THE ROAD BETWEEN",
    title: "Different journeys. One place to start.",
    intro:
      "A vehicle means something different to everyone: an easier commute, space for family, or a way to grow a business. NCR Wheelz brings those decisions into a clear, connected journey from the first shortlist to the next conversation.",
    image: "conversation",
    alt: "Illustrative conversation beside a passenger car outside a showroom",
    items: [
      {
        title: "Explore at your own pace",
        text: "Personal-car and yellow-plate cab inventories have their own filters. Browse what is available, open the details and build a shortlist around your priorities.",
      },
      {
        title: "Put useful tools to work",
        text: "Compare vehicles side by side, check an indicative car value or explore an EMI scenario. These tools help prepare a conversation about an individual vehicle.",
      },
      {
        title: "Keep the next step connected",
        text: "Your account brings saved vehicles, requests and seller submissions together. Ask questions, follow review progress and discuss the details with the team.",
      },
    ],
    links: [
      { label: "Find a car for everyday life", href: "/cars" },
      { label: "Find a vehicle for work", href: "/commercial" },
    ],
  },
  passenger: {
    eyebrow: "A GOOD SHORTLIST STARTS WITH YOU",
    title: "Buying a used car in Delhi NCR? Start with everyday life.",
    intro:
      "The right car should fit the journeys you actually make. Think about your regular passengers, parking space and weekly driving before comparing brands or choosing a body type. Then use the listing details to turn a long list into a useful shortlist.",
    image: "test-drive",
    alt: "Illustrative driver exploring the interior of a parked passenger car",
    items: [
      {
        title: "Set a comfortable whole-car budget",
        text: "Allow for the purchase price, insurance, upkeep and fuel or charging. If you plan to borrow, compare the total repayment as well as the monthly EMI.",
      },
      {
        title: "Read the history behind the number",
        text: "Kilometres driven means the distance on the odometer; mileage means fuel economy. Compare the year, owner count, service records and variant together rather than judging the car on one figure.",
      },
      {
        title: "Use a visit to answer your questions",
        text: "Check the cabin, tyres and visible condition, and ask about past repairs and service history. Request a test drive and consider an independent inspection before deciding.",
      },
    ],
    links: [
      { label: "Compare your shortlist", href: "/compare" },
      { label: "Plan an EMI", href: "/emi-calculator" },
      { label: "Check a car’s value", href: "/car-valuation" },
    ],
  },
  commercial: {
    eyebrow: "CHOOSE FOR THE WORK AHEAD",
    title: "Find a yellow-plate cab that fits your daily routes.",
    intro:
      "Our commercial section is for yellow-plate passenger cabs. Compare sedans, hatchbacks and larger passenger cars around your routes, seating needs and running budget. Use the details to shortlist, then discuss the individual car with the team.",
    image: "inspection",
    alt: "Illustrative vehicle specialist checking a vehicle under its open bonnet",
    items: [
      {
        title: "Choose the right seating and space",
        text: "Consider passenger comfort, luggage space, air conditioning and access to the rear seats. Compare a sedan with a larger MUV if your trips need extra seating, and confirm the seating shown in the registration documents.",
      },
      {
        title: "Plan for the working day",
        text: "Think about distance, fuel, maintenance, tyres and time off the road. The lowest purchase price may not suit your business if the vehicle needs work or does not fit your route.",
      },
      {
        title: "Review the vehicle and its paperwork",
        text: "Discuss service records, registration, insurance and any fitness, permit or tax documents applicable to the vehicle. Confirm current requirements and permitted use with the relevant authority before purchase.",
      },
    ],
    links: [
      { label: "Compare vehicle details", href: "/compare" },
      { label: "Discuss your requirements", href: "/contact" },
    ],
  },
  finance: {
    eyebrow: "A CLEARER WAY TO PLAN",
    title: "Four loan terms worth understanding.",
    intro:
      "A manageable monthly payment is useful, but it is only one part of the decision. Compare the amount borrowed, interest, loan tenure and charges together. Actual eligibility and terms come from your chosen lender.",
    image: "planning",
    alt: "Illustrative car-budget planning with a calculator, notebook and keys",
    items: [
      {
        title: "Down payment",
        text: "This is the amount you pay upfront. With the same car price, paying more upfront reduces the amount you need to borrow. Keep room in your budget for the other costs of ownership.",
      },
      {
        title: "Interest rate",
        text: "The rate affects the cost of borrowing. Ask whether it is fixed or variable and how interest is calculated. Compare the rate together with the lender’s fees and total repayment.",
      },
      {
        title: "Loan tenure",
        text: "This is the repayment period. For the same amount and rate, a longer tenure generally lowers the monthly EMI while increasing total interest. Try different periods in the calculator to see the trade-off.",
      },
      {
        title: "The full repayment amount",
        text: "Ask for a clear repayment schedule and a breakdown of processing, insurance, late-payment and early-repayment charges that may apply. The calculator’s result excludes these additional charges.",
      },
    ],
    links: [
      { label: "Explore EMI scenarios", href: "/emi-calculator" },
      { label: "Browse cars by budget", href: "/cars" },
    ],
    resource: {
      label: "RBI financial education: borrowing and interest",
      href: "https://www.rbi.org.in/financialeducation/content/GUIDE310113_F.pdf",
    },
  },
  emi: {
    eyebrow: "TRY A FEW WHAT-IFS",
    title: "One car. A few different ways to plan for it.",
    intro:
      "Change one input at a time to understand what moves the estimate. Keep the vehicle price and interest rate the same when comparing down payments or loan tenures, so the effect is easier to see.",
    items: [
      {
        title: "Try a higher down payment",
        text: "A larger upfront payment reduces the loan amount. Compare the resulting EMI and total interest, then consider the cash you want to keep available for other expenses.",
      },
      {
        title: "Compare a shorter and longer tenure",
        text: "A shorter tenure usually means a higher EMI and less total interest at the same amount and rate. A longer tenure spreads the payments out. Compare both the monthly and overall numbers.",
      },
      {
        title: "Leave room beyond the EMI",
        text: "Insurance, fuel or charging, servicing, tyres and other charges sit outside this calculation. Use a lender’s written terms to confirm an actual repayment schedule.",
      },
    ],
    links: [
      { label: "Understand car finance terms", href: "/finance" },
      { label: "Explore available cars", href: "/cars" },
    ],
  },
  contact: {
    eyebrow: "LET’S MAKE THE FIRST CONVERSATION USEFUL",
    title: "A few details help us understand what you need.",
    intro:
      "You do not need to have everything worked out before contacting the team. Share what you know, what you are considering and the questions you would like help with. Use the enquiry form for messages rather than uploading sensitive identity documents.",
    image: "conversation",
    alt: "Illustrative conversation about a vehicle outside a showroom",
    items: [
      {
        title: "If you are buying",
        text: "Include the listing you are interested in, a comfortable budget and any important requirements. For a visit or test drive, share your preferred timing and wait for confirmation.",
      },
      {
        title: "If you are selling",
        text: "Start with the brand, model, variant, year, kilometres driven and a short condition description. The selling guide explains private drafts, photos and the document-review process.",
      },
      {
        title: "If you are following up",
        text: "Keep the enquiry or appointment reference and include it in your message. It helps connect your question with the details you previously submitted.",
      },
    ],
    links: [
      { label: "Read the selling guide", href: "/selling-guide" },
      { label: "Browse before your visit", href: "/cars" },
    ],
  },
  comparison: {
    eyebrow: "LOOK AT THE DETAILS TOGETHER",
    title: "Make your comparison count.",
    intro:
      "A comparison is most useful when you know what matters to you. Choose two or three available vehicles, then look beyond the price to understand how each one fits your daily journeys or work.",
    items: [
      {
        title: "Start with a similar use case",
        text: "Compare everyday cars with other cars that could do the same job. For yellow-plate cabs, consider passenger seating, luggage space, fuel economy and the condition of the cabin.",
      },
      {
        title: "Put specifications in context",
        text: "Year, kilometres driven, ownership, fuel and transmission tell different parts of the story. A higher or lower figure does not replace a look at the actual vehicle and its history.",
      },
      {
        title: "Turn differences into questions",
        text: "Use the differences to prepare for a visit. Ask about condition, maintenance, documents and any fees, and explore an indicative EMI if you plan to borrow.",
      },
    ],
    links: [
      { label: "Find passenger cars", href: "/cars" },
      { label: "Explore commercial cabs", href: "/commercial" },
    ],
  },
  valuation: {
    eyebrow: "UNDERSTAND THE BIG PICTURE",
    title: "What goes into a used car’s value?",
    intro:
      "A price guide gives you a starting point for a conversation. Your exact car’s variant, age, condition and history still deserve a closer look. Use the estimate to prepare questions, then discuss the individual vehicle with the team.",
    image: "inspection",
    alt: "Illustrative specialist looking closely at a car’s engine bay",
    items: [
      {
        title: "The car and its specification",
        text: "Brand, model, variant, year, fuel and transmission help describe what you are valuing. Different features and generations can carry different asking prices.",
      },
      {
        title: "The life it has already had",
        text: "Kilometres driven, number of owners, service records and previous repairs help build a fuller picture. A physical inspection can reveal details an online form cannot.",
      },
      {
        title: "The conversation around the price",
        text: "The location, available alternatives and an individual buyer or seller’s circumstances can influence the final discussion. An indicative range is not a guaranteed purchase offer.",
      },
    ],
    links: [
      { label: "Prepare to sell your vehicle", href: "/selling-guide" },
      { label: "Discuss your estimate", href: "/contact" },
    ],
  },
  vehicle: {
    eyebrow: "BEFORE YOU DECIDE",
    title: "Bring a useful checklist to your visit.",
    intro:
      "The listing helps you shortlist. A closer look helps you decide. Use the enquiry form to clarify anything missing and request a visit or test drive when you are ready.",
    items: [
      {
        title: "Condition and history",
        text: "Look at tyres, bodywork, cabin condition and service records. Ask about repairs and consider an independent inspection for a fuller mechanical assessment.",
      },
      {
        title: "Documents and ownership",
        text: "Check registration, insurance and ownership details, and clarify any outstanding finance. Confirm the transfer process and any additional documents applicable to your vehicle.",
      },
      {
        title: "Price and next steps",
        text: "Confirm availability, the final price, applicable charges and any agreed terms directly with the team. An enquiry or test-drive request does not reserve the vehicle.",
      },
    ],
    links: [
      { label: "Explore a loan budget", href: "/emi-calculator" },
      {
        label: "Learn about selling and transfer preparation",
        href: "/selling-guide",
      },
    ],
  },
} satisfies Record<string, GuideContent>;
export type GuideTopic = keyof typeof guides;
