import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";

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
      <AdminNav />
      <main>{children}</main>
    </>
  );
}
