import "server-only";
import { APP_BASE_PATH } from "@/lib/site-paths";

const DEFAULT_SITE_URL = `https://ponevez.com${APP_BASE_PATH}`;

/** The public application URL, including the required /high-holidays prefix. */
export function publicSiteUrl(): string {
  const configured = (process.env.SITE_URL || DEFAULT_SITE_URL).trim();
  let url = new URL(configured);
  if (
    process.env.NODE_ENV === "production" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    url = new URL(DEFAULT_SITE_URL);
  }
  const pathname = url.pathname.replace(/\/$/, "");
  if (pathname !== APP_BASE_PATH && !pathname.endsWith(APP_BASE_PATH)) {
    url.pathname = `${pathname}${APP_BASE_PATH}`;
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
