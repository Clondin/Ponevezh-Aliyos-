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
            <Link href="/find">Find a kibbud</Link>
            <Link href="/about">About the Yeshiva</Link>
            <Link href="/admin">Office</Link>
          </div>
        </div>

        <div>
          <span className="micro">Contact</span>
          <div>
            <a href="mailto:office@ponevez.com">office@ponevez.com</a>
            <br />
            <a href="tel:+12126759260">+1 (212) 675-9260</a>
          </div>
          <Link href="/find" className="site-footer__cta">
            Sponsor a kibbud
          </Link>
        </div>
      </div>

      <div className="site-footer__legal">
        <div className="site-footer__legal-row"><span>&copy; 5787 / 2026 Ponevez Yeshiva. All rights reserved.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/refunds">Refunds</Link></span></div>
      </div>
    </footer>
  );
}
