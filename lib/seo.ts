import "server-only";
import { publicSiteUrl } from "@/lib/site-url";

export function campaignUrl(path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `${publicSiteUrl()}${suffix}`;
}

export function socialImageUrl(): string {
  return campaignUrl("/images/social-card.jpg");
}
