import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";

export const ADMIN_COOKIE = "ponevez-admin-session";
export const ADMIN_SESSION_SECONDS = 4 * 60 * 60;

const SESSION_CONTEXT = "ponevez-admin-session-v2:";

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signature(payload: string, adminToken: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${SESSION_CONTEXT}${process.env.ADMIN_SESSION_SECRET || adminToken}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(signed));
}

async function sessionId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64url(new Uint8Array(digest));
}

export async function createAdminSession(adminToken: string): Promise<string> {
  const payload = `${Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS}.${crypto.randomUUID()}`;
  const value = `${payload}.${await signature(payload, adminToken)}`;
  await getStateStore().set(keys.adminSession(await sessionId(value)), "1", {
    ex: ADMIN_SESSION_SECONDS,
  });
  return value;
}

export async function revokeAdminSession(provided: string | undefined): Promise<void> {
  if (!provided) return;
  await getStateStore().del(keys.adminSession(await sessionId(provided)));
}

export function passwordMatches(provided: string, expected: string): boolean {
  return constantTimeEqual(provided, expected);
}

export async function adminSessionMatches(
  provided: string | undefined,
  adminToken: string
): Promise<boolean> {
  if (!provided) return false;
  const parts = provided.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, providedSignature] = parts;
  if (!/^\d+$/.test(expires) || !nonce || Number(expires) <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (!constantTimeEqual(providedSignature, await signature(`${expires}.${nonce}`, adminToken))) {
    return false;
  }
  return Boolean(
    await getStateStore().get(keys.adminSession(await sessionId(provided)))
  );
}
