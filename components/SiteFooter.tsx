import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div>
          <div className="site-footer__org">
            American Friends of Ponevez Yeshiva in Israel, Inc.
          </div>
          <div>
            1133 Broadway, Suite 519
            <br />
            New York, NY 10010
          </div>
          <div className="site-footer__fine">
            A 501(c)(3) not-for-profit organization.
          </div>
        </div>

        <div>
          <span className="micro">Quick links</span>
          <div className="site-footer__links">
            <Link href="/">Kibbudim</Link>
            <Link href="/">Sponsor a Day</Link>
            <Link href="/">About the Yeshiva</Link>
            <Link href="/admin">Office</Link>
          </div>
        </div>

        <div>
          <span className="micro">Contact</span>
          <div>
            office@ponevez.org
            <br />
            +1 (212) 555&ndash;0140
          </div>
          <Link href="/" className="site-footer__cta">
            Sponsor a kibbud
          </Link>
        </div>
      </div>

      <div className="site-footer__legal">
        <div>&copy; 5787 / 2026 Ponevez Yeshiva. All rights reserved.</div>
      </div>
    </footer>
  );
}
