"use client";

import { useBasket } from "@/components/BasketProvider";

export default function BasketButton({ itemId, compact = false }: { itemId: string; compact?: boolean }) {
  const basket = useBasket();
  const selected = basket.ids.includes(itemId);
  return <button type="button" className={`btn btn--outline-bronze${compact ? " btn--sm" : ""}`} aria-pressed={selected} onClick={() => basket.toggle(itemId)}>{selected ? "Remove from list" : "+ Add to sponsorship list"}</button>;
}
