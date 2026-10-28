export default function Loading() {
  return (
    <div className="container section" aria-label="Loading content">
      <div className="skeleton" style={{ width: "55%", marginBottom: 30 }} />
      <div className="vehicle-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton tall" />
        ))}
      </div>
    </div>
  );
}
