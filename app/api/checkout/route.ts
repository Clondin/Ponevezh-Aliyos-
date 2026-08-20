import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { holdCookieFromRequest } from "@/lib/api/hold-cookie";
import {
  assertBeforeCutoff,
  cardPaymentPayload,
  readJson,
  requireKibbud,
  trustedAmount,
} from "@/lib/api/validation";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
} from "@/lib/redis/repository";
import {
  BanquestApiError,
  BanquestConfigurationError,
} from "@/lib/banquest/client";
import { BanquestDeclinedError, chargeBanquestCard } from "@/lib/banquest/card";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = cardPaymentPayload(await readJson(request));
    const item = requireKibbud(payload.kibbudId);
    assertBeforeCutoff(item);
    const holdCookie = holdCookieFromRequest(request);
    if (!holdCookie || holdCookie.kibbudId !== item.id) throw new HoldExpiredError();
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
    if (error instanceof BanquestConfigurationError) {
      return apiErrorResponse(
        new ApiError(
          "internal",
          "Online payment setup is not complete. Please choose wire or try again later.",
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
