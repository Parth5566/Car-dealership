"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate, useSaved, useToast } from "@/components/providers";
import { api, send } from "@/lib/api";
import { Vehicle } from "@/lib/types";
import { VehicleCard, Empty, ErrorBox } from "@/components/ui";
export default function Saved() {
  const shared = useSaved(),
    toast = useToast();
  const [removing, setRemoving] = useState<number | null>(null);
  const [items, setItems] = useState<Vehicle[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/account/favourites")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, []);
  const remove = (id: number) =>
    setItems((items) => items?.filter((i) => i.id !== id) || []);
  return (
    <AuthGate>
      <div className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR SHORTLIST</span>
            <h1 style={{ fontSize: 38, fontWeight: 500 }}>
              The ones you’re thinking about.
            </h1>
          </div>
          <Link href="/compare" className="text-link">
            Open comparison ↗
          </Link>
        </div>
        {error ? (
          <ErrorBox message={error} />
        ) : !items ? (
          <div className="skeleton tall" />
        ) : items.length ? (
          <div className="vehicle-grid">
            {items.map((v) =>
              v.unavailable ? (
                <div className="panel" key={v.id}>
                  <h2>Listing #{v.id} is unavailable</h2>
                  <p className="subtle">
                    This vehicle may have been sold or archived.
                  </p>
                  <button
                    className="text-button"
                    disabled={removing !== null}
                    onClick={async () => {
                      setRemoving(v.id);
                      try {
                        await api(
                          "/account/favourites/" + v.id,
                          send("DELETE"),
                        );
                        shared.update(v.id, false);
                        remove(v.id);
                      } catch (err) {
                        toast((err as Error).message);
                      } finally {
                        setRemoving(null);
                      }
                    }}
                  >
                    Remove from saved vehicles
                  </button>
                </div>
              ) : (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  saved
                  onRemove={() => remove(v.id)}
                />
              ),
            )}
          </div>
        ) : (
          <Empty
            title="A little space for your favourites."
            action="Find a vehicle"
            href="/cars"
          >
            Tap the heart on any vehicle to save it to your account.
          </Empty>
        )}
      </div>
    </AuthGate>
  );
}
