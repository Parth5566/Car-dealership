import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty">
        <span className="eyebrow">PAGE UNAVAILABLE</span>
        <h1>This road has changed.</h1>
        <p>
          This page may have moved or is no longer available. Explore the latest
          vehicles or visit our journal for buying and selling guides.
        </p>
        <Link className="btn primary" href="/cars">
          Explore used cars ↗
        </Link>
        <p>
          <Link className="text-link" href="/blog">
            Read the journal ↗
          </Link>
        </p>
      </div>
    </div>
  );
}
