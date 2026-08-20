"use client";

export default function PrintButton() {
  return (
    <button className="btn btn--emphasis" onClick={() => window.print()}>
      Print sheet
    </button>
  );
}
