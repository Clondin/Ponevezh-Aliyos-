import type { Metadata } from "next";
import Script from "next/script";
import { David_Libre, Marcellus, Public_Sans } from "next/font/google";
import "@/styles/globals.css";

const display = Marcellus({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});
const ui = Public_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ui",
});
const hebrew = David_Libre({
  weight: ["400", "500", "700"],
  subsets: ["hebrew", "latin"],
  variable: "--font-hebrew",
});

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
    images: [{ url: "/images/social-card.jpg", width: 1200, height: 630 }],
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
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${hebrew.variable}`}
    >
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
