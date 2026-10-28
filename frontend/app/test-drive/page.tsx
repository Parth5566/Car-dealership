import { serverApi } from "@/lib/server";
import { Vehicle } from "@/lib/types";
import { EnquiryForm } from "@/components/enquiry-form";
import { Empty, ErrorBox } from "@/components/ui";
export const metadata = {
  title: "Request a test drive",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle } = await searchParams;
  if (!vehicle)
    return (
      <div className="container section">
        <h1>Request a test drive.</h1>
        <Empty
          title="Which vehicle would you like to drive?"
          action="Browse vehicles"
          href="/cars"
        >
          Open a vehicle listing to request a test drive.
        </Empty>
      </div>
    );
  const { data: v, error } = await serverApi<Vehicle>("/vehicles/" + vehicle);
  return (
    <div className="container section content-width">
      <span className="eyebrow">GET A FEEL FOR YOUR NEXT CHAPTER</span>
      <h1 style={{ fontSize: 35, fontWeight: 500, marginBottom: 25 }}>
        Request a test drive.
      </h1>
      {v ? (
        <div className="panel">
          <h2>
            {v.year} {v.make} {v.model}
          </h2>
          <EnquiryForm testDrive vehicleId={v.id} />
        </div>
      ) : (
        <ErrorBox message={error || "Vehicle unavailable"} />
      )}
    </div>
  );
}
