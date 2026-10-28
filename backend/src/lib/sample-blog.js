// Starter article requested by the owner. Imported explicitly, never on startup.
const text = (value) => ({ type: "text", text: value });
const paragraph = (...content) => ({
  type: "paragraph",
  content: content.map((value) =>
    typeof value === "string" ? text(value) : value,
  ),
});
const heading = (value) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
});
const link = (label, href) => ({
  ...text(label),
  marks: [{ type: "link", attrs: { href } }],
});
const bullets = (items) => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
});

module.exports = {
  slug: "used-car-buying-checklist-delhi-ncr",
  title: "Buying a Used Car in Delhi NCR: A Practical Checklist",
  excerpt:
    "From choosing a shortlist to asking the right questions on a test drive, use this checklist to prepare for your next used-car visit in Delhi NCR.",
  category: "buying",
  author_name: "NCR Wheelz",
  seo_title: "Used Car Buying Checklist for Delhi NCR",
  seo_description:
    "Plan your used-car purchase in Delhi NCR: compare your shortlist, inspect condition, prepare for a test drive and confirm the details before deciding.",
  seo_keywords:
    "used car buying checklist, used cars Delhi NCR, used car inspection",
  cover_alt:
    "A mechanic checking the engine bay of a silver car with its bonnet open",
  body: {
    type: "doc",
    content: [
      paragraph(
        "A used-car search is easier when you know what to compare. A listing can help you build a shortlist, but photographs and an asking price are only the beginning. Before deciding, spend time with the actual car, ask about its history and write down the details that matter to you.",
      ),
      paragraph(
        "This checklist is designed for your first conversation and visit. Keep it on your phone, add your own questions and use the same notes for each vehicle. That makes it easier to compare cars without relying on memory or a single attractive feature.",
      ),
      heading("1. Start with your everyday journey"),
      paragraph(
        "Think about where the car will spend most of its time. A daily commute, narrow parking space, family trips and occasional longer journeys create different priorities. Sit in the front and rear seats, check the boot and consider who will usually travel with you.",
      ),
      bullets([
        "Write down your usual journey length and the number of passengers.",
        "Decide which features are essential and which would simply be nice to have.",
        "Compare fuel type and transmission with your driving pattern and comfort.",
        "Check whether the car fits your parking space and everyday luggage needs.",
      ]),
      paragraph(
        "Start with a small shortlist from the ",
        link("used passenger cars", "/cars"),
        " page. Save the listings you like so you can return to the exact specifications and questions later.",
      ),
      heading("2. Leave room in the budget beyond the asking price"),
      paragraph(
        "Your purchase budget should leave room for the costs you expect after taking the car home. Ask what the quoted price includes and which costs are separate. Consider insurance, servicing, tyres or other work identified during inspection, as well as your regular running costs.",
      ),
      paragraph(
        "If you plan to finance the purchase, compare the down payment, loan tenure and total repayment as well as the monthly EMI. The ",
        link("EMI calculator", "/emi-calculator"),
        " can help you explore scenarios; the lender must confirm the actual terms and eligibility.",
      ),
      heading("3. Compare similar cars, then investigate the differences"),
      paragraph(
        "Two cars with the same model name can differ in age, variant, mileage, ownership history and condition. Record these details alongside each asking price. A higher price needs an explanation, while a lower price deserves the same careful checks as any other listing.",
      ),
      paragraph(
        "Use the ",
        link("car valuation tool", "/car-valuation"),
        " as an indicative starting point for a discussion. A market-based estimate cannot inspect the individual car or confirm its service history, and it is not a guaranteed purchase offer.",
      ),
      heading("4. Inspect the car in person"),
      paragraph(
        "Arrange a visit with enough time to look at the vehicle calmly. Ask for a clear explanation of known repairs, defects and service needs. If you are unsure how to assess mechanical condition, arrange an independent inspection by a mechanic you trust before committing.",
      ),
      bullets([
        "Look around the bodywork, glass and tyres, and ask about anything that appears inconsistent.",
        "Try the air conditioning, windows, lights and controls while the vehicle is safely stationary.",
        "Ask to see available service records and discuss gaps in the history.",
        "Record any work promised before handover and confirm how it will be documented.",
      ]),
      heading("5. Make the test drive useful"),
      paragraph(
        "Confirm the appointment and any requirements with the team before travelling. During an agreed test drive, pay attention to seating position, visibility, steering, braking and gear changes. Check whether you feel comfortable in the car, and mention any unfamiliar noise or behaviour rather than trying to diagnose it yourself.",
      ),
      paragraph(
        "Keep your attention on the road. Write your notes after parking safely and ask any follow-up questions before moving on to the next vehicle. A test-drive request through the website is an enquiry; availability and timing still need confirmation.",
      ),
      heading("6. Confirm the paperwork and final terms"),
      paragraph(
        "Ask who is selling the vehicle, what supporting records are available and how the ownership-transfer process will be handled. Have the vehicle details and documents checked by an appropriate professional where needed. Confirm current local requirements for your intended use before paying.",
      ),
      paragraph(
        "Get the agreed vehicle price, included work, payment arrangements and handover terms in writing. If a warranty, cancellation option or other benefit is mentioned, ask for its specific written terms. Do not assume that a benefit offered for one car applies to every vehicle.",
      ),
      heading("A simple comparison note to keep"),
      bullets([
        "Vehicle: model, variant, year, kilometres and ownership history.",
        "Budget: quoted price, included costs and expected work after purchase.",
        "Condition: inspection findings, service records and unanswered questions.",
        "Next step: test drive, independent inspection or written clarification.",
      ]),
      paragraph(
        "When your notes are complete, compare the whole picture rather than one headline number. If you would like to discuss a listing, ",
        link("contact NCR Wheelz", "/contact"),
        " with the vehicle link, your preferred budget and the questions you want to cover. The team can help you plan the next conversation.",
      ),
    ],
  },
};
