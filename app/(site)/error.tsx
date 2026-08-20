"use client";

import Link from "next/link";

export default function ErrorScreen({
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
      <h1>Something went wrong</h1>
      <p>
        We couldn&rsquo;t load this page. Nothing has been charged and no kibbud
        has been taken.
      </p>
      <div className="actions">
        <button onClick={reset} className="btn btn--fill">
          Try again
        </button>
        <Link href="/" className="btn btn--outline">
          Home
        </Link>
      </div>
    </div>
  );
}
