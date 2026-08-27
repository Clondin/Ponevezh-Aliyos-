import { listBanquestTransactions } from "@/lib/banquest/transactions";
import { queueAndSyncCheckoutToAdmire } from "@/lib/admire/client";
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
  failed: number;
}

export async function reconcileBanquestTransactions(): Promise<ReconciliationResult> {
  const repository = getRepository();
  let offset = 0;
  let checked = 0;
  let updated = 0;
  let failed = 0;
  const pageSize = 100;
  const maxPages = 3;

  for (let page = 0; page < maxPages; page += 1) {
    const transactions = await listBanquestTransactions(offset, pageSize);
    for (const transaction of transactions) {
      try {
        const paymentId =
          transaction.custom_fields?.custom1 ?? transaction.transaction_details?.key;
        if (!paymentId) continue;
        const checkout = await repository.checkout(paymentId);
        if (!checkout) continue;
        checked += 1;
        if (transaction.id != null) {
          await repository.updateCheckoutGateway(paymentId, {
            gatewayTransactionId: String(transaction.id),
            cardType:
              typeof transaction.card_details?.card_type === "string"
                ? transaction.card_details.card_type
                : undefined,
            cardLastFour:
              typeof transaction.card_details?.last4 === "string"
                ? transaction.card_details.last4
                : undefined,
          });
        }
        const status = transaction.status_details?.status;
        if (status && FAILED.has(status)) {
          if (checkout.status !== "reversed" && checkout.status !== "released") {
            await repository.reverseCheckout(paymentId, `Banquest reconciliation: ${status}`);
            updated += 1;
          }
        } else if (status === "settled" || status === "captured" || status === "approved") {
          if (
            transaction.amount_details?.amount != null &&
            transaction.amount_details.amount + 0.005 < checkout.amount
          ) {
            await repository.markCheckoutNeedsReview(
              paymentId,
              `Reconciliation found $${transaction.amount_details.amount.toFixed(2)} for an expected $${checkout.amount.toFixed(2)}.`
            );
            updated += 1;
            continue;
          }
          if (checkout.status !== "sold") {
            await repository.markCheckoutGroupSold(paymentId, "card");
            updated += 1;
          }
          await queueAndSyncCheckoutToAdmire(paymentId).catch((error) =>
            console.error(error)
          );
        }
      } catch (error) {
        failed += 1;
        console.error("Banquest reconciliation skipped one transaction:", error);
      }
    }
    if (transactions.length < pageSize) break;
    offset += transactions.length;
  }

  await repository.appendAudit({
    action: "reconciliation_run",
    detail: `${checked} payments checked; ${updated} updated; ${failed} failed`,
  });

  return { checked, updated, failed };
}
