import type { Order, Pledge } from "@/contracts/types";

export interface HoldRecord {
  kibbudId: string;
  token: string;
  kind: "checkout" | "pledge";
  expiresAt: string;
}

export interface PendingRecord {
  kibbudId: string;
  kind: "checkout" | "pledge";
  referenceId: string;
  expiresAt: string;
}

export interface CheckoutRecord {
  paymentId: string;
  kibbudId: string;
  holdToken: string;
  donorName: string;
  email: string;
  misheberachNames: string[];
  amount: number;
  preferredMethod: "card";
  status: "created" | "pending" | "sold" | "released" | "reversed";
  createdAt: string;
}

export interface StoredPledge extends Pledge {}
export interface StoredOrder extends Order {}

export interface SetOptions {
  ex?: number;
  nx?: true;
  xx?: true;
}

export interface StateStore {
  get<T>(key: string): Promise<T | null>;
  mget<T extends unknown[]>(...keys: string[]): Promise<T>;
  set<T>(key: string, value: T, options?: SetOptions): Promise<"OK" | T | null>;
  del(...keys: string[]): Promise<number>;
  sadd<T>(key: string, ...members: T[]): Promise<number>;
  srem<T>(key: string, ...members: T[]): Promise<number>;
  smembers<T extends unknown[] = string[]>(key: string): Promise<T>;
}
