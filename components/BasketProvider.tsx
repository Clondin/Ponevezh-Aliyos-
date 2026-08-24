"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BASKET_EVENT, basketIds, setBasketIds } from "@/lib/basket";

interface BasketContextValue {
  ids: string[];
  ready: boolean;
  toggle(id: string): boolean;
  remove(id: string): void;
  clear(): void;
}

const BasketContext = createContext<BasketContextValue | null>(null);

export default function BasketProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setIds(basketIds());
    sync();
    setReady(true);
    window.addEventListener(BASKET_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(BASKET_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const value = useMemo<BasketContextValue>(() => ({
    ids,
    ready,
    toggle(id) {
      const selected = ids.includes(id);
      setBasketIds(selected ? ids.filter((item) => item !== id) : [...ids, id]);
      return !selected;
    },
    remove(id) { setBasketIds(ids.filter((item) => item !== id)); },
    clear() { setBasketIds([]); },
  }), [ids, ready]);
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const value = useContext(BasketContext);
  if (!value) throw new Error("useBasket must be used inside BasketProvider");
  return value;
}
