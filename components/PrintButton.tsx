"use client";

import React from "react";

export default function PrintButton({ label = "Print sheet" }: { label?: string }) {
  return (
    <button type="button" className="btn btn--sm btn--outline-bronze no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
