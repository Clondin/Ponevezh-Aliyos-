import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Yomim Noraim Kibbudim 5787 — Ponevez Yeshiva",
    template: "%s — Ponevez Yeshiva Kibbudim",
  },
  description:
    "Sponsor a kibbud for the Yomim Noraim 5787 across the six minyanim of Ponevez Yeshiva, Bnei Brak.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <body>{children}</body>
    </html>
  );
}
