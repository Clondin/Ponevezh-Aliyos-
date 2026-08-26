import type { Occasion } from "@/contracts/types";

const DEFAULT_WAVE_OPENINGS: Record<Occasion["wave"], string> = {
  1: "2026-08-25T00:00:00-04:00",
  2: "2026-08-25T00:00:00-04:00",
};

export function waveOpensAt(wave: Occasion["wave"]): string {
  const configured = process.env[`WAVE_${wave}_OPENS_AT`]?.trim();
  const value = configured || DEFAULT_WAVE_OPENINGS[wave];
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`WAVE_${wave}_OPENS_AT must be an ISO date and time`);
  }
  return value;
}

export function isWaveOpen(wave: Occasion["wave"], now = Date.now()): boolean {
  return now >= Date.parse(waveOpensAt(wave));
}

export function saleWindowFor(occasion: Occasion, now = Date.now()): "upcoming" | "open" | "closed" {
  if (!isWaveOpen(occasion.wave, now)) return "upcoming";
  if (now >= Date.parse(occasion.cutoffISO)) return "closed";
  return "open";
}
