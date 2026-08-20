export function authorizationCredential(header: string | null): string | null {
  if (!header) return null;
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1];

  const basic = header.match(/^Basic\s+(.+)$/i);
  if (!basic) return null;
  try {
    const decoded = atob(basic[1]);
    const separator = decoded.indexOf(":");
    return separator >= 0 ? decoded.slice(separator + 1) : null;
  } catch {
    return null;
  }
}
