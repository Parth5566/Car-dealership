"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="container section">
      <div className="empty">
        <h1>We hit a bump in the road.</h1>
        <p>Please try loading this page again.</p>
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
