import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__mark" aria-label="Ponevez — home">
          Ponevez
        </Link>
        <nav className="site-header__nav" aria-label="Main">
          <Link href="/" className="active">
            Kibbudim
          </Link>
          <Link href="/">Sponsor a Day</Link>
          <Link href="/">The Yeshiva</Link>
          <Link href="/">Contact</Link>
        </nav>
        <Link href="/" className="site-header__donate">
          Donate
        </Link>
      </div>
    </header>
  );
}
