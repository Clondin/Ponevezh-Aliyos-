export const ADMIN_COOKIE = "ponevez-admin-session";
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

const SESSION_CONTEXT = "ponevez-admin-session-v1:";

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function adminSessionValue(adminToken: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${SESSION_CONTEXT}${adminToken}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function passwordMatches(provided: string, expected: string): boolean {
  return constantTimeEqual(provided, expected);
}

export async function adminSessionMatches(
  provided: string | undefined,
  adminToken: string
): Promise<boolean> {
  if (!provided) return false;
  return constantTimeEqual(provided, await adminSessionValue(adminToken));
}
