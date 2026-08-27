import { banquestRequest } from "@/lib/banquest/client";

interface BanquestReversalResponse {
  status?: string;
  reference_number?: number;
  transaction?: { id?: number };
}

/**
 * Fully reverses a Banquest charge. The gateway chooses a void before settlement
 * and a refund after settlement, so callers do not have to race the batch close.
 */
export async function reverseBanquestTransaction(
  referenceNumber: string
): Promise<BanquestReversalResponse> {
  const reference = Number(referenceNumber);
  if (!Number.isSafeInteger(reference) || reference < 1) {
    throw new Error("A valid Banquest reference number is required for reversal.");
  }
  return banquestRequest<BanquestReversalResponse>("/transactions/reversal", {
    method: "POST",
    body: JSON.stringify({ reference_number: reference }),
  });
}
