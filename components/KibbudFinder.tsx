"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usd } from "@/lib/format";
import BasketButton from "@/components/BasketButton";

export interface FinderItem {
  id: string;
  name: string;
  hebrewName: string;
  minyan: string;
  minyanName: string;
  occasion: string;
  occasionName: string;
  dateLabel: string;
  tier: "regular" | "special" | "very-special";
  price: number;
  state: "available" | "held" | "sold" | "pending" | "upcoming" | "closed";
  href: string;
}

export default function KibbudFinder({ items }: { items: FinderItem[] }) {
  const [query, setQuery] = useState("");
  const [minyan, setMinyan] = useState("all");
  const [occasion, setOccasion] = useState("all");
  const [tier, setTier] = useState("all");
  const [availability, setAvailability] = useState("available");
  const [maxPrice, setMaxPrice] = useState("all");
  const minyanOptions = useMemo(() => Array.from(new Map(items.map((item) => [item.minyan, item.minyanName]))), [items]);
  const occasionOptions = useMemo(() => Array.from(new Map(items.map((item) => [item.occasion, item.occasionName]))), [items]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ceiling = maxPrice === "all" ? Infinity : Number(maxPrice);
    return items.filter((item) =>
      (minyan === "all" || item.minyan === minyan) &&
      (occasion === "all" || item.occasion === occasion) &&
      (tier === "all" || item.tier === tier) &&
      (availability === "all" || item.state === "available") &&
      item.price <= ceiling &&
      (!needle || `${item.name} ${item.hebrewName} ${item.minyanName} ${item.occasionName}`.toLowerCase().includes(needle))
    );
  }, [availability, items, maxPrice, minyan, occasion, query, tier]);

  return (
    <>
      <div className="finder-controls">
        <label className="finder-search"><span>Search</span><input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kibbud, minyan or tefillah" /></label>
        <label><span>Minyan</span><select className="input" value={minyan} onChange={(event) => setMinyan(event.target.value)}><option value="all">All minyanim</option>{minyanOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Day</span><select className="input" value={occasion} onChange={(event) => setOccasion(event.target.value)}><option value="all">All days</option>{occasionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Type</span><select className="input" value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All types</option><option value="regular">Regular</option><option value="special">Special</option><option value="very-special">Very special</option></select></label>
        <label><span>Price</span><select className="input" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="all">Any price</option><option value="500">Up to $500</option><option value="1000">Up to $1,000</option><option value="2500">Up to $2,500</option><option value="5000">Up to $5,000</option></select></label>
        <label><span>Availability</span><select className="input" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="available">Available now</option><option value="all">Show all</option></select></label>
      </div>
      <div className="finder-summary" role="status">{results.length} kibbud{results.length === 1 ? "" : "im"} found</div>
      <div className="finder-grid">
        {results.map((item) => {
          const available = item.state === "available";
          const body = <><div><div className="kibbud-card__he" lang="he">{item.hebrewName}</div><div className="kibbud-card__name">{item.name}</div><div className="finder-card__where">{item.occasionName} · {item.minyanName}</div><div className="finder-card__date">{item.dateLabel}</div></div><div className="kibbud-card__strip"><span className="kibbud-card__price">{usd(item.price)}</span><span className="kibbud-card__action">{available ? "Sponsor" : item.state === "sold" ? "Sponsored" : item.state === "upcoming" ? "Opening soon" : item.state === "closed" ? "Closed" : "Reserved"}</span></div></>;
          return available ? <div className="finder-result" key={item.id}><Link className={`kibbud-card kibbud-card--${item.tier}`} href={item.href}>{body}</Link><BasketButton itemId={item.id} compact /></div> : <div className={`kibbud-card kibbud-card--${item.tier} kibbud-card--dim`} key={item.id}>{body}</div>;
        })}
      </div>
      {!results.length ? <div className="notice" style={{ padding: "48px 0" }}><h2>No matching kibbudim</h2><p>Try removing a filter or increasing the price range.</p></div> : null}
    </>
  );
}
