import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BasketProvider from "@/components/BasketProvider";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BasketProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </BasketProvider>
  );
}
