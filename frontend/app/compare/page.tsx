import { Comparison } from "@/components/comparison";
import { Faq } from "@/components/faq";
import { EditorialGuide } from "@/components/editorial-guide";
export const metadata = {
  title: "Compare vehicles",
  description:
    "Choose two or three NCR Wheelz vehicles and compare prices, specifications and features side by side.",
  alternates: { canonical: "/compare" },
};
export default function Page() {
  return (
    <>
      <Comparison />
      <EditorialGuide topic="comparison" />
      <Faq topic="buying" />
    </>
  );
}
