import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { holdCookieFromRequest } from "@/lib/api/hold-cookie";
import {
  assertSaleOpen,
  cardPaymentPayload,
  readJson,
  requireKibbud,
  trustedAmount,
} from "@/lib/api/validation";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
  CheckoutInProgressError,
} from "@/lib/storage/repository";
import {
  assertBanquestCheckoutReady,
  BanquestApiError,
  BanquestConfigurationError,
} from "@/lib/banquest/client";
import { BanquestDeclinedError, chargeBanquestCard } from "@/lib/banquest/card";

export async function POST(request: Request): Promise<Response> {
  try {
    assertBanquestCheckoutReady();
    await enforceRateLimit(request, "checkout", 10, 15 * 60);
    const payload = cardPaymentPayload(await readJson(request));
    const item = requireKibbud(payload.kibbudId);
    assertSaleOpen(item);
    const holdCookie = holdCookieFromRequest(request);
    if (
      !holdCookie ||
      holdCookie.kibbudId !== item.id ||
      Boolean(holdCookie.kibbudIds?.length)
    ) {
      throw new HoldExpiredError();
    }
    await getRepository().checkoutHold(item.id, holdCookie.token);
    const payment = await chargeBanquestCard(
      item,
      payload,
      holdCookie.token,
      trustedAmount(item)
    );
    return Response.json(payment);
  } catch (error) {
    if (error instanceof HoldExpiredError) {
      return apiErrorResponse(
        new ApiError("hold_expired", "Your hold has expired. Please reserve the kibbud again.", 410)
      );
    }
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(
        new ApiError("already_taken", "This kibbud is already reserved or sponsored.", 409)
      );
    }
    if (error instanceof CheckoutInProgressError) {
      return apiErrorResponse(
        new ApiError(
          "already_taken",
          "This payment is already being submitted. Please do not submit it again.",
          409
        )
      );
    }
    if (error instanceof BanquestConfigurationError) {
      return apiErrorResponse(
        new ApiError(
          "internal",
          "Online payment setup is not complete. Please try again shortly.",
          503
        )
      );
    }
    if (error instanceof BanquestDeclinedError) {
      return apiErrorResponse(
        new ApiError("invalid_input", error.message, 402)
      );
    }
    if (error instanceof BanquestApiError) {
      return apiErrorResponse(
        new ApiError(
          "internal",
          "The payment service could not start this payment. Please try again.",
          502
        )
      );
    }
    return apiErrorResponse(error);
  }
}
