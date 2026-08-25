import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/site-paths";
import { publicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  return {
    rules: [{
      userAgent: "*",
      allow: `${withBasePath("/")}/`,
      disallow: [
        `${withBasePath("/admin")}/`,
        withBasePath("/confirmation"),
        withBasePath("/basket/confirmation"),
      ],
    }],
    sitemap: `${base}/sitemap.xml`,
  };
}
