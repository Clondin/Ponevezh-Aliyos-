import type { Order, Pledge } from "@/contracts/types";

export interface HoldRecord {
  kibbudId: string;
  token: string;
  kind: "checkout" | "pledge";
  expiresAt: string;
  holdUntilReviewed?: boolean;
}

export interface PendingRecord {
  kibbudId: string;
  kind: "checkout" | "pledge";
  referenceId: string;
  expiresAt: string;
  holdUntilReviewed?: boolean;
}

export interface CheckoutRecord {
  paymentId: string;
  kibbudId: string;
  kibbudIds?: string[];
  amounts?: Record<string, number>;
  holdToken: string;
  donorName: string;
  email: string;
  phone?: string;
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
  status: "created" | "processing" | "pending" | "sold" | "released" | "reversed" | "needs_review";
  createdAt: string;
  completedAt?: string;
  gatewayRequestStartedAt?: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
  cardType?: string;
  cardLastFour?: string;
  reversalReason?: string;
}

export interface StoredPledge extends Pledge {
  kibbudIds?: string[];
  amounts?: Record<string, number>;
  paymentSource?: "manual" | "admire";
  /** Admire reservations remain unavailable until the office confirms or releases them. */
  holdUntilReviewed?: boolean;
  externalReference?: string;
  dedicationType?: "honor" | "memory";
  dedicationName?: string;
  dedicationMessage?: string;
  honoreeEmail?: string;
  publicRecognition?: boolean;
  recognitionName?: string;
  assignmentAcceptedAt?: string;
}

export interface StoredOrder extends Order {
  phone?: string;
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
  status?: "paid" | "refunded";
  refundedAt?: string;
  refundReason?: string;
}

export interface AdmireSyncJob {
  paymentId: string;
  attempts: number;
  status: "queued" | "processing" | "failed";
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
  lastError?: string;
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
    | "payment_needs_review"
    | "admire_sync_queued"
    | "admire_sync_completed"
    | "admire_sync_failed"
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

export interface AtomicCondition {
  key: string;
  exists?: boolean;
  equals?: unknown;
}

export interface AtomicSetOperation {
  key: string;
  value: unknown;
  ex?: number;
  nx?: true;
}

export interface AtomicWrite {
  conditions?: AtomicCondition[];
  sets?: AtomicSetOperation[];
  deletes?: string[];
  setAdds?: Array<{ key: string; members: unknown[] }>;
  setRemoves?: Array<{ key: string; members: unknown[] }>;
}

export interface StateStore {
  get<T>(key: string): Promise<T | null>;
  mget<T extends unknown[]>(...keys: string[]): Promise<T>;
  set<T>(key: string, value: T, options?: SetOptions): Promise<"OK" | T | null>;
  del(...keys: string[]): Promise<number>;
  sadd<T>(key: string, ...members: T[]): Promise<number>;
  srem<T>(key: string, ...members: T[]): Promise<number>;
  smembers<T extends unknown[] = string[]>(key: string): Promise<T>;
  /** Applies a conditional group of writes as one transaction. */
  atomic(write: AtomicWrite): Promise<boolean>;
  /** Atomically increments an expiring numeric counter and returns the new value. */
  increment(key: string, seconds: number): Promise<number>;
  /** Removes expired key/value rows in bounded batches. */
  purgeExpired(limit?: number): Promise<number>;
}
