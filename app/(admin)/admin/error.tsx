"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="notice">
      <div className="notice__glyph" aria-hidden="true">
        ✳
      </div>
      <h1>Couldn&rsquo;t load office data</h1>
      <p>The records are safe; this page just failed to render.</p>
      <div className="actions">
        <button onClick={reset} className="btn btn--fill">
          Try again
        </button>
      </div>
    </div>
  );
}
