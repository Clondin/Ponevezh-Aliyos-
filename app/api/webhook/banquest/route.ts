import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { queueAndSyncCheckoutToAdmire } from "@/lib/admire/client";
import { reverseBanquestTransaction } from "@/lib/banquest/reversal";
import {
  type BanquestWebhookEvent,
  parseBanquestWebhook,
  verifyBanquestSignature,
} from "@/lib/banquest/webhook";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
} from "@/lib/storage/repository";

const FAILED_STATUSES = new Set([
  "returned",
  "cancelled",
  "declined",
  "error",
  "voided",
  "blocked",
  "expired",
]);
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  if (
    !verifyBanquestSignature(rawBody, request.headers.get("x-signature"))
  ) {
    return apiErrorResponse(
      new ApiError("invalid_input", "Invalid Banquest webhook signature.", 400)
    );
  }

  let event: BanquestWebhookEvent;
  try {
    event = parseBanquestWebhook(rawBody);
  } catch {
    return apiErrorResponse(
      new ApiError("invalid_input", "Invalid Banquest webhook payload.", 400)
    );
  }

  const repository = getRepository();
  const claim = await repository.beginPaymentEvent(event.id);
  if (claim === "done") return Response.json({ received: true });
  if (claim === "busy") {
    return Response.json({ received: false, retry: true }, { status: 503 });
  }

  try {
    if (event.event !== "transaction" || !event.paymentId) {
      await repository.finishPaymentEvent(event.id);
      return Response.json({ received: true });
    }

    const isRefund = event.subType === "refund";
    const isVoid = event.subType === "void";
    const failed =
      event.type === "declined" ||
      event.type === "error" ||
      isVoid ||
      isRefund ||
      Boolean(event.status && FAILED_STATUSES.has(event.status));

    const checkout = await repository.checkout(event.paymentId);
    if (checkout && (event.transactionId || event.referenceNumber)) {
      await repository.updateCheckoutGateway(event.paymentId, {
        gatewayTransactionId: event.transactionId,
        gatewayReference: event.referenceNumber,
        cardType: event.cardType,
        cardLastFour: event.cardLastFour,
      });
    }

    if (failed) {
      if (
        isRefund &&
        checkout?.status === "sold" &&
        event.amount != null &&
        event.amount + 0.005 < checkout.amount
      ) {
        await repository.markCheckoutNeedsReview(
          event.paymentId,
          `Partial Banquest refund of $${event.amount.toFixed(2)} requires item-level office review.`
        );
      } else if (checkout?.status === "sold" || checkout?.status === "pending") {
        await repository.reverseCheckout(
          event.paymentId,
          isRefund ? "Banquest refund" : isVoid ? "Banquest void" : "Banquest payment failed"
        );
      } else {
        await repository.releaseCheckout(event.paymentId);
      }
    } else if (
      checkout &&
      event.amount != null &&
      event.amount + 0.005 < checkout.amount
    ) {
      await repository.markCheckoutNeedsReview(
        event.paymentId,
        `Banquest reported $${event.amount.toFixed(2)} for an expected $${checkout.amount.toFixed(2)}.`
      );
    } else if (
      (event.type === "succeeded" && event.subType === "charge") ||
      event.status === "settled"
    ) {
      try {
        await repository.markCheckoutGroupSold(event.paymentId, "card");
      } catch (error) {
        if (!(error instanceof AlreadyTakenError)) throw error;
        if (event.referenceNumber) {
          try {
            await reverseBanquestTransaction(event.referenceNumber);
            await repository.reverseCheckout(
              event.paymentId,
              "Automatically reversed after webhook inventory conflict"
            );
          } catch (reversalError) {
            await repository.markCheckoutNeedsReview(
              event.paymentId,
              `Webhook payment could not settle or reverse: ${
                reversalError instanceof Error ? reversalError.message : "unknown reversal error"
              }`
            );
          }
        } else {
          await repository.markCheckoutNeedsReview(
            event.paymentId,
            "Webhook payment could not settle and had no reversal reference."
          );
        }
        throw error;
      }
      await queueAndSyncCheckoutToAdmire(event.paymentId).catch((error) =>
        console.error(error)
      );
    }

    await repository.finishPaymentEvent(event.id);
    return Response.json({ received: true });
  } catch (error) {
    await repository.failPaymentEvent(event.id);
    if (error instanceof HoldExpiredError) {
      // The webhook is authentic but does not match a retained one-time link.
      // A reconciliation run can recover it once the local record is restored.
      return Response.json({ received: true });
    }
    if (error instanceof AlreadyTakenError) {
      console.error("A Banquest payment could not claim its reserved kibbud.");
      return Response.json({ received: true });
    }
    return apiErrorResponse(error);
  }
}
