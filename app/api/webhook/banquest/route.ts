import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import {
  type BanquestWebhookEvent,
  parseBanquestWebhook,
  verifyBanquestSignature,
} from "@/lib/banquest/webhook";
import { sendOrderNotifications, sendReversalNotifications } from "@/lib/notifications/email";
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
  if (claim !== "process") return Response.json({ received: true });

  try {
    if (event.event !== "transaction" || !event.paymentId) {
      await repository.finishPaymentEvent(event.id);
      return Response.json({ received: true });
    }

    const failed =
      event.type === "declined" ||
      event.type === "error" ||
      event.subType === "void" ||
      event.subType === "refund" ||
      Boolean(event.status && FAILED_STATUSES.has(event.status));

    const checkout = await repository.checkout(event.paymentId);
    if (checkout && (event.transactionId || event.referenceNumber)) {
      await repository.updateCheckoutGateway(event.paymentId, {
        gatewayTransactionId: event.transactionId,
        gatewayReference: event.referenceNumber,
      });
    }

    if (failed) {
      if (checkout?.status === "sold" || checkout?.status === "pending") {
        await repository.reverseCheckout(event.paymentId);
      } else {
        await repository.releaseCheckout(event.paymentId);
      }
      if (checkout) {
        await sendReversalNotifications(checkout).catch((error) => console.error(error));
      }
    } else if (
      checkout &&
      event.amount != null &&
      event.amount + 0.005 < checkout.amount
    ) {
      await repository.markCheckoutPending(event.paymentId);
      console.error("Banquest reported a payment below the expected sponsorship total.");
    } else if (
      (event.type === "succeeded" && event.subType === "charge") ||
      event.status === "settled"
    ) {
      const orders = await repository.markCheckoutGroupSold(event.paymentId, "card");
      await Promise.all(
        orders.map((order) => sendOrderNotifications(order).catch((error) => console.error(error)))
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
