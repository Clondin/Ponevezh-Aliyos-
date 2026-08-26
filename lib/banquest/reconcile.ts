import { listBanquestTransactions } from "@/lib/banquest/transactions";
import { sendOrderNotifications, sendReversalNotifications } from "@/lib/notifications/email";
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
      const checkout = await repository.checkout(paymentId);
      if (checkout && transaction.id != null) {
        await repository.updateCheckoutGateway(paymentId, {
          gatewayTransactionId: String(transaction.id),
        });
      }
      const status = transaction.status_details?.status;
      if (status && FAILED.has(status)) {
        await repository.reverseCheckout(paymentId);
        if (checkout) {
          await sendReversalNotifications(checkout).catch((error) => console.error(error));
        }
        updated += 1;
      } else if (status === "settled" || status === "captured" || status === "approved") {
        if (
          checkout &&
          transaction.amount_details?.amount != null &&
          transaction.amount_details.amount + 0.005 < checkout.amount
        ) {
          continue;
        }
        const orders = await repository.markCheckoutGroupSold(paymentId, "card");
        await Promise.all(
          orders.map((order) => sendOrderNotifications(order).catch((error) => console.error(error)))
        );
        updated += 1;
      }
    }
    if (transactions.length < 100) break;
    offset += transactions.length;
  }

  await repository.appendAudit({
    action: "reconciliation_run",
    detail: `${checked} payments checked; ${updated} updated`,
  });

  return { checked, updated };
}
