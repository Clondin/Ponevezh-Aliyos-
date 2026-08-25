export const APP_BASE_PATH = "/kibbudim";

/** Prefix a root-relative URL that is handled directly by the browser. */
export function withBasePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (
    path === APP_BASE_PATH ||
    path.startsWith(`${APP_BASE_PATH}/`) ||
    path.startsWith(`${APP_BASE_PATH}?`) ||
    path.startsWith(`${APP_BASE_PATH}#`)
  ) {
    return path;
  }
  return path === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${path}`;
}
