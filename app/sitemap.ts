import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL || "https://ponevez-kibbudim.pages.dev").replace(/\/$/, "");
  const catalog = getCatalog();
  const staticPaths = ["", "/find", "/about", "/contact", "/privacy", "/terms", "/refunds", "/sponsors"];
  const minyanPaths = catalog.minyanim.map((minyan) => `/${minyan.slug}`);
  const occasionPaths = catalog.minyanim.flatMap((minyan) =>
    catalog.occasions
      .filter((occasion) => !occasion.minyanim || occasion.minyanim.includes(minyan.slug))
      .map((occasion) => `/${minyan.slug}/${occasion.slug}`)
  );
  const itemPaths = catalog.items.map((item) => `/${item.minyan}/${item.occasion}/${item.slug}`);
  return [...staticPaths, ...minyanPaths, ...occasionPaths, ...itemPaths].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-08-24T00:00:00-04:00"),
    changeFrequency: path === "" || path === "/find" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/find" ? 0.9 : 0.7,
  }));
}
