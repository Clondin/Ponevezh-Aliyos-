import { banquestRequest } from "@/lib/banquest/client";

export interface BanquestTransaction {
  id?: number;
  created_at?: string;
  transaction_details?: {
    key?: string;
  };
  custom_fields?: {
    custom1?: string;
  };
  status_details?: {
    status?: string;
  };
  card_details?: Record<string, unknown>;
  check_details?: Record<string, unknown>;
}

export function transactionMethod(
  transaction: BanquestTransaction
): "card" | "ach" | "unknown" {
  if (transaction.check_details) return "ach";
  if (transaction.card_details) return "card";
  return "unknown";
}

export async function listBanquestTransactions(
  offset = 0,
  limit = 100
): Promise<BanquestTransaction[]> {
  const query = new URLSearchParams({
    order: "desc",
    limit: String(limit),
    offset: String(offset),
  });
  return banquestRequest<BanquestTransaction[]>(`/transactions?${query.toString()}`);
}
