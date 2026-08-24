export const BASKET_KEY = "ponevez-kibbudim-basket";
export const BASKET_EVENT = "ponevez-basket-change";

export function basketIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(BASKET_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
  } catch { return []; }
}

export function setBasketIds(ids: string[]): void {
  const unique = Array.from(new Set(ids)).slice(0, 10);
  window.localStorage.setItem(BASKET_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event(BASKET_EVENT));
}

export function toggleBasketId(id: string): boolean {
  const current = basketIds();
  const selected = current.includes(id);
  setBasketIds(selected ? current.filter((item) => item !== id) : [...current, id]);
  return !selected;
}

export function clearBasket(): void { setBasketIds([]); }
