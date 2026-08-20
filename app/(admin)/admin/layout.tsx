import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Office", template: "%s — Ponevez Office" },
  robots: { index: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="admin-bar no-print">
        <div className="container admin-bar__inner">
          <span className="brand">PONEVEZ &middot; Office</span>
          <Link href="/admin">Overview</Link>
          <Link href="/admin/pledges">Pledges</Link>
          <Link href="/admin/sold">Sold</Link>
          <span style={{ marginLeft: "auto" }}>
            <Link href="/">&larr; Donor site</Link>
          </span>
        </div>
      </div>
      <main>{children}</main>
    </>
  );
}
