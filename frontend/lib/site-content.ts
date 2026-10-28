// Publish customer quotes with permission. Offers are managed in Admin → Discounts & offers.
export type Testimonial = { name: string; quote: string; context: string };
export const testimonials: Testimonial[] = [];
export const sampleTestimonials: Testimonial[] = [
  {
    name: "Aarav Sharma",
    context: "A first car, a fresh start",
    quote:
      "I wanted a car for my everyday commute and weekend plans. Being able to compare my shortlist made the choice feel much simpler.",
  },
  {
    name: "Neha Kapoor",
    context: "More room for family adventures",
    quote:
      "Space, comfort and a sensible budget were at the top of my list. A test drive helped me decide what felt right for our family.",
  },
  {
    name: "Rajesh Verma",
    context: "The next step for a small business",
    quote:
      "For my business, passenger comfort mattered as much as price. Seeing the vehicle details side by side helped me ask the right questions.",
  },
];
