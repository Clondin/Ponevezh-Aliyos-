import type { Occasion } from "@/contracts/types";

const DEFAULT_WAVE_OPENINGS: Record<Occasion["wave"], string> = {
  // The office approved opening every 5787 kibbud on August 25.
  1: "2026-08-25T00:00:00-04:00",
  2: "2026-08-25T00:00:00-04:00",
};

function validOpening(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && /(Z|[+-]\d{2}:\d{2})$/i.test(value);
}

export function waveOpensAt(wave: Occasion["wave"]): string {
  const configured = process.env[`WAVE_${wave}_OPENS_AT`]?.trim();
  if (configured && !validOpening(configured)) {
    console.error(
      `Ignoring invalid WAVE_${wave}_OPENS_AT; use an ISO time with a UTC offset.`
    );
    return DEFAULT_WAVE_OPENINGS[wave];
  }
  return configured || DEFAULT_WAVE_OPENINGS[wave];
}

export function isWaveOpen(wave: Occasion["wave"], now = Date.now()): boolean {
  return now >= Date.parse(waveOpensAt(wave));
}

export function saleWindowFor(occasion: Occasion, now = Date.now()): "upcoming" | "open" | "closed" {
  if (!isWaveOpen(occasion.wave, now)) return "upcoming";
  if (now >= Date.parse(occasion.cutoffISO)) return "closed";
  return "open";
}
