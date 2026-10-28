import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { serverApi } from "@/lib/server";
import { Vehicle } from "@/lib/types";
import { Empty, ErrorBox, VehicleCard } from "./ui";

export async function HomeInventory({
  type,
}: {
  type: "passenger" | "commercial";
}) {
  const commercial = type === "commercial";
  const href = commercial ? "/commercial" : "/cars";
  const title = commercial ? "Commercial cabs" : "Passenger cars";
  const sectionId = commercial ? "commercial-vehicles" : "passenger-cars";
  const [recent, featured, facets] = await Promise.all([
    serverApi<{ items: Vehicle[]; total: number }>(
      `/vehicles?type=${type}&limit=3`,
    ),
    serverApi<{ items: Vehicle[] }>(
      `/vehicles?type=${type}&featured=true&limit=3`,
    ),
    serverApi<{ makes: { make: string; count: number }[] }>(
      `/facets?type=${type}`,
    ),
  ]);
  // Feature actual listings first, then include recent arrivals without duplicates.
  const vehicles = Array.from(
    new Map(
      [...(featured.data?.items || []), ...(recent.data?.items || [])].map(
        (vehicle) => [vehicle.id, vehicle],
      ),
    ).values(),
  );

  return (
    <section
      id={sectionId}
      className={`inventory-section inventory-${type}`}
      aria-labelledby={`${sectionId}-title`}
    >
      <div className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {commercial ? "FOR YOUR BUSINESS" : "FOR YOUR EVERYDAY JOURNEYS"}
            </span>
            <h2 id={`${sectionId}-title`}>{title}</h2>
            <p className="category-description">
              {commercial
                ? "Find commercial cabs by vehicle style and the weight of goods they can carry."
                : "Passenger inventory, with hatchbacks, sedans, SUVs and more as listings become available."}
            </p>
          </div>
          <Link className="text-link" href={href}>
            {commercial ? "View commercial cabs" : "View passenger cars"}{" "}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {facets.data?.makes.length ? (
          <nav className="inventory-makes" aria-label={`${title} by brand`}>
            {facets.data.makes.map((make) => (
              <Link
                key={make.make}
                href={`${href}?make=${encodeURIComponent(make.make)}`}
              >
                {make.make} <span>{make.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}
        {vehicles.length ? (
          <>
            <p className="mini-title">
              {featured.data?.items.length
                ? "Featured & recently added"
                : "Recently added"}{" "}
              {title.toLowerCase()}
            </p>
            <div className="vehicle-grid">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          </>
        ) : recent.error ? (
          <ErrorBox message={recent.error} />
        ) : (
          <Empty
            title={
              commercial
                ? "Commercial arrivals are on their way."
                : "Your next passenger car could be here soon."
            }
            action={
              commercial ? "Browse commercial cabs" : "Browse passenger cars"
            }
            href={href}
          >
            {commercial
              ? "Approved commercial listings will appear in this section when published."
              : "Approved passenger listings will appear in this section when published."}
          </Empty>
        )}
      </div>
    </section>
  );
}
