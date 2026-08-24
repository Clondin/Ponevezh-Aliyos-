import Link from "next/link";
import BasketLink from "@/components/BasketLink";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__mark" aria-label="Ponevez — home">
          Ponevez
        </Link>
        <nav className="site-header__nav" aria-label="Main">
          <Link href="/find">Find a kibbud</Link>
          <a href="https://script.google.com/macros/s/AKfycbwrpV8Q3qShDwPbmJ6WbG8TynpQCM2AVSUHF1sUexbLcfbSK83diYp5Xun6WSPZQBNR/exec" target="_blank" rel="noreferrer">Sponsor a Day</a>
          <Link href="/about">The Yeshiva</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <details className="site-header__mobile">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile">
            <Link href="/">Kibbudim</Link>
            <Link href="/find">Find a kibbud</Link>
            <Link href="/sponsors">With gratitude</Link>
            <Link href="/about">The Yeshiva</Link>
            <Link href="/contact">Contact</Link>
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
