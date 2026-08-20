import { listBanquestTransactions } from "@/lib/banquest/transactions";
import { sendDonorConfirmation } from "@/lib/notifications/email";
import { getRepository } from "@/lib/storage/repository";

const FAILED = new Set([
  "returned",
  "cancelled",
  "declined",
  "error",
  "voided",
  "blocked",
  "expired",
]);

export interface ReconciliationResult {
  checked: number;
  updated: number;
}

export async function reconcileBanquestTransactions(): Promise<ReconciliationResult> {
  const repository = getRepository();
  let offset = 0;
  let checked = 0;
  let updated = 0;

  for (;;) {
    const transactions = await listBanquestTransactions(offset, 100);
    for (const transaction of transactions) {
      const paymentId =
        transaction.custom_fields?.custom1 ?? transaction.transaction_details?.key;
      if (!paymentId || !(await repository.checkout(paymentId))) continue;
      checked += 1;
      const status = transaction.status_details?.status;
      if (status && FAILED.has(status)) {
        await repository.reverseCheckout(paymentId);
        updated += 1;
      } else if (status === "settled" || status === "captured" || status === "approved") {
        const order = await repository.markCheckoutSold(paymentId, "card");
        await sendDonorConfirmation(order).catch((error) => console.error(error));
        updated += 1;
      }
    }
    if (transactions.length < 100) break;
    offset += transactions.length;
  }

  return { checked, updated };
}
