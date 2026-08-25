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
  kibbudIds?: string[];
  amounts?: Record<string, number>;
  holdToken: string;
  donorName: string;
  email: string;
  misheberachNames: string[];
  dedicationType?: "honor" | "memory";
  dedicationName?: string;
  dedicationMessage?: string;
  honoreeEmail?: string;
  publicRecognition?: boolean;
  recognitionName?: string;
  assignmentAcceptedAt?: string;
  amount: number;
  preferredMethod: "card";
  status: "created" | "pending" | "sold" | "released" | "reversed";
  createdAt: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
}

export interface StoredPledge extends Pledge {
  dedicationType?: "honor" | "memory";
  dedicationName?: string;
  dedicationMessage?: string;
  honoreeEmail?: string;
  publicRecognition?: boolean;
  recognitionName?: string;
  assignmentAcceptedAt?: string;
}

export interface StoredOrder extends Order {
  paymentId?: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
  dedicationType?: "honor" | "memory";
  dedicationName?: string;
  dedicationMessage?: string;
  honoreeEmail?: string;
  publicRecognition?: boolean;
  recognitionName?: string;
  assignmentAcceptedAt?: string;
}

export interface AuditRecord {
  id: string;
  action:
    | "hold_created"
    | "payment_started"
    | "payment_pending"
    | "payment_completed"
    | "payment_released"
    | "payment_reversed"
    | "pledge_created"
    | "pledge_confirmed"
    | "pledge_released"
    | "email_retried"
    | "reconciliation_run";
  createdAt: string;
  kibbudId?: string;
  referenceId?: string;
  detail?: string;
}

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
