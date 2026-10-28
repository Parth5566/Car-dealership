"use client";
import { useEffect, useState, useRef } from "react";
import { api, download } from "@/lib/api";
import { label } from "@/lib/types";
import { ErrorBox } from "@/components/ui";
export default function Reports() {
  const [from, setFrom] = useState("2020-01-01"),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [d, setD] = useState<any>(null),
    [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);
  async function load() {
    const request = ++generation.current;
    setError("");
    setD(null);
    try {
      const result = await api(`/admin/reports?from=${from}&to=${to}`);
      if (request === generation.current) setD(result);
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    return () => {
      ++generation.current;
    };
  }, []);
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Reports that reflect reality.</h1>
          <p>
            Aggregate operational outcomes within the selected creation date
            range.
          </p>
        </div>
      </div>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label>
          From{" "}
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="btn primary small">Apply range</button>
        <button
          type="button"
          className="text-button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setError("");
            try {
              await download(
                `/admin/reports/export?from=${from}&to=${to}`,
                `lead-status-${from}-${to}.csv`,
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Preparing CSV…" : "Export aggregate lead CSV"}
        </button>
      </form>
      {error ? (
        <ErrorBox message={error} />
      ) : d ? (
        <>
          <div className="two-columns">
            {[
              ["Inventory by type", "inventory"],
              ["Lead funnel", "leads"],
              ["Test-drive outcomes", "test_drives"],
              ["Seller submission outcomes", "submissions"],
            ].map(([title, key]) => (
              <div className="panel" key={key}>
                <h2>{title}</h2>
                {d[key].length ? (
                  d[key].map((r: any) => (
                    <div className="activity" key={r.label}>
                      <span>{label(r.label)}</span>
                      <strong>{r.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="subtle">No data in this date range.</p>
                )}
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Listing performance</h2>
            <p className="subtle" style={{ marginBottom: 20 }}>
              {d.note}
            </p>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Views</th>
                    <th>Enquiries</th>
                  </tr>
                </thead>
                <tbody>
                  {d.performance.map((v: any) => (
                    <tr key={v.id}>
                      <td>
                        {v.make} {v.model}
                      </td>
                      <td data-label="Status">{v.status}</td>
                      <td data-label="Views">{v.views}</td>
                      <td data-label="Enquiries">{v.enquiries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="skeleton tall" />
      )}
    </>
  );
}
