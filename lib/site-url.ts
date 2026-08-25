import "server-only";
import { APP_BASE_PATH } from "@/lib/site-paths";

const DEFAULT_SITE_URL = `https://ponevez-kibbudim.pages.dev${APP_BASE_PATH}`;

/** The public application URL, including the required /kibbudim prefix. */
export function publicSiteUrl(): string {
  const configured = (process.env.SITE_URL || DEFAULT_SITE_URL).trim();
  const url = new URL(configured);
  const pathname = url.pathname.replace(/\/$/, "");
  if (pathname !== APP_BASE_PATH && !pathname.endsWith(APP_BASE_PATH)) {
    url.pathname = `${pathname}${APP_BASE_PATH}`;
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
