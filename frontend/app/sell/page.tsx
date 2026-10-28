"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGate, useAuth } from "@/components/providers";
import { VehicleEditor } from "@/components/vehicle-editor";
import { api, send } from "@/lib/api";
export default function Sell() {
  const router = useRouter(),
    { user } = useAuth();
  return (
    <AuthGate>
      <div className="page-heading">
        <div className="container">
          <span className="eyebrow">YOUR VEHICLE’S NEXT CHAPTER</span>
          <h1>Let’s get the details right.</h1>
          <p>
            Save your vehicle details to notify our team. You can then add
            photos and documents, or wait for us to contact you.
          </p>
          <Link className="text-link" href="/selling-guide">
            Read the selling steps and document guide ↗
          </Link>
        </div>
      </div>
      <div className="container section content-width">
        <div className="tabs">
          <span className="btn small primary">01 · Vehicle details</span>
          <span className="btn small">02 · Photos & documents</span>
          <span className="btn small">03 · Submit for review</span>
        </div>
        <div className="panel">
          <h2>Tell us about your vehicle</h2>
          <VehicleEditor
            seller
            contact={
              user
                ? { name: user.name, email: user.email, phone: user.phone }
                : undefined
            }
            onSave={async (vehicle, contact) => {
              const r = await api(
                "/account/submissions",
                send("POST", { vehicle, contact }),
              );
              router.push("/account/submissions/" + r.id);
            }}
          />
        </div>
        <p className="subtle">
          Your submission is private. Approval means the manual review passed;
          publication is a separate staff action. Do not upload Aadhaar.
          Document review does not guarantee authenticity, legal title, or
          condition.
        </p>
      </div>
    </AuthGate>
  );
}
