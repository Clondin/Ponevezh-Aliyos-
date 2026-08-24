"use client";

import Link from "next/link";
import { useBasket } from "@/components/BasketProvider";

export default function BasketLink() {
  const count = useBasket().ids.length;
  return <Link href="/basket" className="site-header__basket" aria-label={`Sponsorship list with ${count} items`}>List{count ? ` (${count})` : ""}</Link>;
}
