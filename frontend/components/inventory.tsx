import Link from "next/link";
import { GitCompareArrows, ChevronRight, CarFront } from "lucide-react";
import { serverApi } from "@/lib/server";
import { Vehicle } from "@/lib/types";
import { VehicleCard, Empty, ErrorBox } from "./ui";
import { InventoryFilters, InventorySort } from "./inventory-filters";
import { Faq } from "./faq";
import { EditorialGuide } from "./editorial-guide";
import { PageSchema, StructuredData } from "./structured-data";
import { absoluteUrl } from "@/lib/site";
import { CorporateCabs } from "./corporate-cabs";
export async function Inventory({
  type,
  params,
}: {
  type: "passenger" | "commercial";
  params: Record<string, string | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v && k !== "min_payload") query.set(k, v);
  query.set("type", type);
  const { data, error, status } = await serverApi<{
    items: Vehicle[];
    total: number;
    page: number;
    pages: number;
  }>("/vehicles?" + query);
  const commercial = type === "commercial";
  const base = commercial ? "/commercial" : "/cars";
  function pageUrl(p: number) {
    const q = new URLSearchParams(query);
    q.delete("type");
    q.set("page", String(p));
    return base + "?" + q;
  }
  return (
    <div className="inventory-page">
      <PageSchema path={base} />
      {data && (
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: data.items
              .filter((v) => !v.is_sample)
              .map((v, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${v.year} ${v.make} ${v.model}`,
                url: absoluteUrl(`/vehicles/${v.id}/${v.slug}`),
              })),
          }}
        />
      )}
      <div className="page-heading">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={11} />
            <span>{commercial ? "Commercial cabs" : "Passenger cars"}</span>
          </div>
          <span className="eyebrow">
            {commercial
              ? "READY FOR THE WORK AHEAD"
              : "FIND YOUR EVERYDAY COMPANION"}
          </span>
          <h1>{commercial ? "Commercial cabs" : "Passenger cars"}</h1>
          <p>
            {commercial
              ? "Explore used yellow-plate passenger cabs for your daily routes, and ask about corporate and MNC office attachment opportunities."
              : "Explore used passenger cars. Find the details, compare your options, and take the next step."}
          </p>
          {commercial && (
            <a className="text-link" href="#corporate-cab-attachment">
              Explore corporate cab attachments <ChevronRight size={15} />
            </a>
          )}
        </div>
      </div>
      <nav
        className="container inventory-categories"
        aria-label="Vehicle categories"
      >
        <Link href="/cars" aria-current={!commercial ? "page" : undefined}>
          <CarFront size={20} /> Passenger cars
        </Link>
        <Link href="/commercial" aria-current={commercial ? "page" : undefined}>
          <CarFront size={20} /> Commercial cabs
        </Link>
      </nav>
      <div className="container inventory-layout">
        <aside
          className="filters compact-filters"
          aria-labelledby="vehicle-filters-heading"
        >
          <InventoryFilters
            key={query.toString()}
            type={type}
            params={params}
            maxYear={new Date().getFullYear() + 1}
          />
        </aside>
        <div>
          <div className="results-toolbar">
            <strong>
              {data
                ? `${data.total} ${commercial ? "commercial cabs" : "cars"} found`
                : "Inventory"}
            </strong>
            <div>
              <InventorySort key={query.toString()} value={params.sort} />
              <Link href="/compare" className="text-link">
                <GitCompareArrows size={15} />
                Compare
              </Link>
            </div>
          </div>
          {error ? (
            status === 400 || status === 422 ? (
              <div className="notice error" role="alert">
                <p>{error}</p>
                <Link className="text-link" href={base}>
                  Reset filters
                </Link>
              </div>
            ) : (
              <ErrorBox message={error} />
            )
          ) : data?.items.length ? (
            <>
              <div className="vehicle-grid">
                {data.items.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
              <div className="pagination">
                {data.page > 1 && (
                  <Link
                    className="btn small outline"
                    href={pageUrl(data.page - 1)}
                  >
                    Previous
                  </Link>
                )}
                <span>
                  Page {data.page} of {data.pages}
                </span>
                {data.page < data.pages && (
                  <Link
                    className="btn small primary"
                    href={pageUrl(data.page + 1)}
                  >
                    Next
                  </Link>
                )}
              </div>
            </>
          ) : (
            <Empty
              title="No vehicles match just yet."
              action="Clear filters"
              href={base}
            >
              Try adjusting your filters, or come back as more approved vehicles
              are published.
            </Empty>
          )}
        </div>
      </div>
      {commercial && <CorporateCabs />}
      <EditorialGuide topic={commercial ? "commercial" : "passenger"} />
      <Faq topic={commercial ? "commercial" : "buying"} />
    </div>
  );
}
