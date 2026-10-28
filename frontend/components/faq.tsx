import Link from "next/link";
import { Plus, MessageCircle } from "lucide-react";
import { resolveBusiness } from "@/lib/business";
import type { Settings } from "@/lib/types";
import { StructuredData } from "./structured-data";

const questions = {
  contact: [
    [
      "Can I enquire about corporate cab attachment?",
      "Yes. Tell us whether you need a yellow-plate cab or already own one, and share the model, year and your preferred operating area. Our team can discuss current corporate and MNC office requirements, vehicle suitability and payment terms.",
    ],
    [
      "How can I reach NCR Wheelz?",
      "Call 99581 25967 or 96502 01495, email ncrwheelz@gmail.com, or send the enquiry form above. Our working hours are 9:00 AM–10:00 PM, India time.",
    ],
    [
      "Where can I find you?",
      "We’re in Tilak Nagar, New Delhi. Use the map above for directions and call before visiting to confirm the vehicle you want to see is available.",
    ],
    [
      "How do I follow up on my enquiry?",
      "Keep the enquiry reference shown after submitting the form. Share it with our team when you call or email so we can find your request.",
    ],
    [
      "Can I arrange a test drive?",
      "Yes. Open a vehicle listing and request a test drive from your account. Our team will contact you to confirm the date, time and availability.",
    ],
  ],
  about: [
    [
      "What does NCR Wheelz offer?",
      "We help you browse used passenger cars and commercial cabs in Delhi NCR, compare your shortlist and submit a vehicle for sale. We also help connect suitable commercial cabs with corporate and MNC offices for employee transport.",
    ],
    [
      "Which tools can I use before contacting the team?",
      "Compare up to three vehicles, check an indicative car value and explore an EMI scenario without signing in. An account lets you save vehicles, request a test drive and follow seller submissions.",
    ],
    [
      "How are vehicles listed?",
      "Seller details and documents go through a manual review before staff approve and publish a listing. Check the vehicle’s condition and documents in person before buying.",
    ],
    [
      "Can I sell a commercial cab too?",
      "Yes. Choose the commercial category on the Sell your vehicle page and follow its document checklist. You can track the review from your account.",
    ],
  ],
  buying: [
    [
      "How do I compare cars?",
      "Select Compare on two or three vehicle cards. Open the comparison bar to see prices, kilometres driven, vehicle details and features side by side. You can remove a choice and add another.",
    ],
    [
      "Do I need an account to browse or compare?",
      "No. Browsing, comparison and the EMI calculator are available without signing in. Create an account to save vehicles, track requests or request a test drive.",
    ],
    [
      "Does an enquiry reserve a vehicle?",
      "No. Sending an enquiry starts a conversation with our team. Please confirm the current availability, price and any reservation terms directly with us.",
    ],
    [
      "What should I check before buying?",
      "Inspect the vehicle, review its service history and documents, and discuss any questions with the team. Listing information helps you shortlist; an in-person inspection helps you decide.",
    ],
  ],
  commercial: [
    [
      "Can NCR Wheelz help attach my cab to a corporate office?",
      "Yes. We help owners explore cab attachment opportunities with corporate and MNC offices in Delhi NCR. Share your vehicle model, year and operating area, or tell us you need to buy a cab. An attachment depends on current assignments and the office’s vehicle requirements.",
    ],
    [
      "Will a corporate cab attachment give me a fixed income?",
      "A corporate assignment can offer regular work. Any fixed monthly payment, duty hours and payment schedule must be confirmed in the contract. Take-home income depends on your running costs, including any driver, fuel, maintenance and finance payments you are responsible for.",
    ],
    [
      "What does commercial mean on NCR Wheelz?",
      "Our commercial section is for yellow-plate cars used as passenger cabs. Choose a car by its seating, fuel type, price and condition. Trucks and goods carriers are outside this section.",
    ],
    [
      "Can I compare commercial cabs?",
      "Yes. Select two or three listings and open Compare. Number of seats appears when provided, alongside price, fuel type, kilometres driven and other details.",
    ],
    [
      "Which documents should I check?",
      "Ask about registration, insurance, fitness, applicable permits and any outstanding finance or challans. Requirements vary by vehicle and intended use; confirm them before proceeding.",
    ],
  ],
  emi: [
    [
      "How is the EMI calculated?",
      "EMI means your monthly loan payment. The calculator uses the amount borrowed (vehicle price minus your upfront payment), the yearly interest rate and the number of months you will take to repay. Interest is calculated on the remaining loan balance. At zero interest, the loan is divided equally across the months.",
    ],
    [
      "What does a bigger down payment change?",
      "A down payment is the amount you pay upfront. Paying more upfront reduces the amount you borrow. With the same interest rate and repayment period, this lowers your estimated monthly payment and total interest.",
    ],
    [
      "Are fees and insurance included?",
      "No. The result covers the amount borrowed and interest only. Confirm processing fees, insurance, taxes and other charges separately with your bank or lender.",
    ],
    [
      "Is this a loan approval or a final quote?",
      "No. The inputs are for planning. Your lender sets the actual interest rate, eligibility, repayment schedule and final terms.",
    ],
  ],
  selling: [
    [
      "Does saving my draft put the car on the website?",
      "No. Your draft stays private to you and authorised staff. Complete the photos and document checklist, then submit it for review. Approval and public listing are separate staff steps.",
    ],
    [
      "Can I change the details after submitting?",
      "A submitted vehicle is locked while it is being reviewed. If the team requests more information, follow the instructions in your account and resubmit the same submission.",
    ],
    [
      "Is an online valuation a purchase offer?",
      "No. It is an indicative guide. The team needs to discuss the individual vehicle, its condition and documents before agreeing on any price or next step.",
    ],
    [
      "Which documents do I need?",
      "Use the checklist shown in your submission. Requirements differ for passenger and commercial cabs. Do not upload Aadhaar, and confirm ownership-transfer requirements with the relevant transport authority.",
    ],
  ],
  finance: [
    [
      "Can I apply for a loan on this website?",
      "No lender application service is currently configured. The finance information and EMI calculator help you prepare; confirm eligibility and actual terms with your chosen lender.",
    ],
    [
      "What information should I prepare for a lender?",
      "A lender may ask for identity and address evidence, income information, bank statements and vehicle details. Ask for its checklist and share sensitive documents only through an authorised secure channel.",
    ],
    [
      "Should I compare only the monthly EMI?",
      "Compare the interest rate, loan tenure, charges and total repayment too. A longer tenure can reduce the monthly payment while increasing total interest at the same loan amount and rate.",
    ],
  ],
  discounts: [
    [
      "How do I check whether an offer applies to a vehicle?",
      "Ask our team about the exact listing you are considering. Any published offer will state its benefit, eligibility, terms and expiry date.",
    ],
    [
      "Can I combine discounts?",
      "Only if the terms of the specific offers allow it. Confirm the final price and any applicable charges with our team before making a decision.",
    ],
    [
      "Why are there no active offers listed?",
      "We only display confirmed offers within their validity dates. You can still contact us to discuss current pricing and availability for a vehicle.",
    ],
  ],
};
export type FaqTopic = keyof typeof questions;
export function Faq({
  topic,
  title = "Good questions. Clear answers.",
  settings = {},
}: {
  topic: FaqTopic;
  title?: string;
  settings?: Partial<Settings>;
}) {
  const business = resolveBusiness(settings);
  const entries =
    topic === "contact"
      ? questions.contact.map((entry, index) =>
          index === 0
            ? [
                entry[0],
                `Send the enquiry form above${business.phones.length ? ", call " + business.phones.map((p) => p.display).join(" or ") : ""}${business.email ? ", or email " + business.email : ""}.${business.hours ? " Working hours: " + business.hours + ", India time." : ""}`,
              ]
            : index === 1
              ? [
                  entry[0],
                  `${business.address ? "Find us at " + business.address + ". " : ""}Use the directions link above and contact our team before visiting to confirm availability.`,
                ]
              : entry,
        )
      : questions[topic];
  return (
    <section
      className="container section faq-section"
      aria-labelledby={`faq-${topic}`}
    >
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: entries.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }}
      />
      <div className="faq-intro">
        <span className="eyebrow">
          <MessageCircle size={18} /> A LITTLE HELP ALONG THE WAY
        </span>
        <h2 id={`faq-${topic}`}>{title}</h2>
        <p>
          Still have something on your mind? We’re happy to talk it through.
        </p>
        <Link className="text-link" href="/contact">
          Talk to our team ↗
        </Link>
      </div>
      <div className="faq-list">
        {entries.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <Plus size={20} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
