import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "https://ponevez-kibbudim.pages.dev";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/confirmation", "/basket/confirmation"] }],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
