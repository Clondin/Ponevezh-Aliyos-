"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BasketLink from "@/components/BasketLink";

const SPONSOR_DAY_URL =
  "https://script.google.com/macros/s/AKfycbwrpV8Q3qShDwPbmJ6WbG8TynpQCM2AVSUHF1sUexbLcfbSK83diYp5Xun6WSPZQBNR/exec";

export default function SiteHeader() {
  const pathname = usePathname();
  const mobile = useRef<HTMLDetailsElement>(null);
  const closeMobile = () => mobile.current?.removeAttribute("open");
  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
      ? "active"
      : undefined;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobile();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (mobile.current?.open && !mobile.current.contains(event.target as Node)) {
        closeMobile();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__mark" aria-label="Ponevez — home">
          Ponevez
        </Link>
        <nav className="site-header__nav" aria-label="Main">
          <Link href="/find" className={active("/find")}>Find a kibbud</Link>
          <a href={SPONSOR_DAY_URL} target="_blank" rel="noreferrer">Sponsor a Day</a>
          <Link href="/about" className={active("/about")}>The Yeshiva</Link>
          <Link href="/contact" className={active("/contact")}>Contact</Link>
        </nav>
        <details ref={mobile} className="site-header__mobile">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile">
            <Link href="/" onClick={closeMobile}>Kibbudim</Link>
            <Link href="/find" onClick={closeMobile}>Find a kibbud</Link>
            <a href={SPONSOR_DAY_URL} target="_blank" rel="noreferrer" onClick={closeMobile}>Sponsor a Day</a>
            <Link href="/about" onClick={closeMobile}>The Yeshiva</Link>
            <Link href="/contact" onClick={closeMobile}>Contact</Link>
          </nav>
        </details>
        <BasketLink />
        <Link href="/find" className="site-header__donate">
          Donate
        </Link>
      </div>
    </header>
  );
}
