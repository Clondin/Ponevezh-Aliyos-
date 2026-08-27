"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { withBasePath } from "@/lib/site-paths";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pledges", label: "Payments" },
  { href: "/admin/sold", label: "Summary" },
  { href: "/admin/activity", label: "History" },
];

export default function AdminNav() {
  const pathname = usePathname();
  // Strip the basePath so comparisons work against the logical hrefs.
  const path = pathname.replace(withBasePath(""), "") || "/";
  const isActive = (href: string) =>
    href === "/admin" ? path === "/admin" : path.startsWith(href);

  // The login screen is unauthenticated — show only the mark, no sections.
  if (path === "/admin/login") {
    return (
      <div className="admin-bar admin-bar--minimal no-print">
        <div className="container admin-bar__inner">
          <span className="admin-bar__brand">
            <span className="admin-bar__mark">פוניבז׳</span>
            <span className="admin-bar__office">Office</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-bar no-print">
      <div className="container admin-bar__inner">
        <Link href="/admin" className="admin-bar__brand">
          <span className="admin-bar__mark">פוניבז׳</span>
          <span className="admin-bar__office">Office</span>
        </Link>
        <nav className="admin-bar__nav" aria-label="Office sections">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? "is-active" : undefined}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="admin-bar__end">
          <Link href="/" className="admin-bar__exit">
            <span aria-hidden="true">&larr;</span> Donor site
          </Link>
          <form action={withBasePath("/api/admin/logout")} method="post">
            <button className="admin-logout" type="submit">
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
