"use client";

import { useEffect, useState } from "react";

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function useCountdown(expiresAt: string): number | null {
  // null until mounted so server and client HTML agree
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    setSecs(remaining(expiresAt));
    const t = setInterval(() => setSecs(remaining(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return secs;
}

export function formatSecs(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
