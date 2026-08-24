import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://ponevez-kibbudim.pages.dev"),
  title: {
    default: "Yomim Noraim Kibbudim 5787 — Ponevez Yeshiva",
    template: "%s — Ponevez Yeshiva Kibbudim",
  },
  description:
    "Sponsor a kibbud for the Yomim Noraim 5787 across the six minyanim of Ponevez Yeshiva, Bnei Brak.",
  openGraph: {
    title: "Yomim Noraim Kibbudim 5787 — Ponevez Yeshiva",
    description: "Choose and sponsor a kibbud across the six minyanim of Ponevez Yeshiva.",
    type: "website",
    images: [{ url: "/images/yeshiva/beis-medrash.webp", width: 1920, height: 1078 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const analyticsToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN?.trim();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Marcellus&family=Public+Sans:wght@300;400;500;600&family=David+Libre:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {analyticsToken ? (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: analyticsToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
