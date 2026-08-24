import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { holdCookieFromRequest } from "@/lib/api/hold-cookie";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { assertSaleOpen, cartPaymentPayload, readJson, requireKibbud, trustedAmount } from "@/lib/api/validation";
import { chargeBanquestCard, BanquestDeclinedError } from "@/lib/banquest/card";
import { BanquestApiError, BanquestConfigurationError } from "@/lib/banquest/client";
import { AlreadyTakenError, CheckoutInProgressError, getRepository, HoldExpiredError } from "@/lib/storage/repository";

export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit(request, "cart-checkout", 6, 15 * 60);
    const payload = cartPaymentPayload(await readJson(request));
    const items = payload.kibbudIds.map(requireKibbud);
    items.forEach((item) => assertSaleOpen(item));
    const holdCookie = holdCookieFromRequest(request);
    const heldIds = holdCookie?.kibbudIds ?? [];
    if (!holdCookie || heldIds.length !== payload.kibbudIds.length || !heldIds.every((id, index) => id === payload.kibbudIds[index])) {
      throw new HoldExpiredError();
    }
    await Promise.all(items.map((item) => getRepository().checkoutHold(item.id, holdCookie.token)));
    const amounts = Object.fromEntries(items.map((item) => [item.id, trustedAmount(item)]));
    return Response.json(await chargeBanquestCard(items, payload, holdCookie.token, amounts));
  } catch (error) {
    if (error instanceof HoldExpiredError) return apiErrorResponse(new ApiError("hold_expired", "Your combined hold expired. Please reserve the kibbudim again.", 410));
    if (error instanceof AlreadyTakenError) return apiErrorResponse(new ApiError("already_taken", "One of these kibbudim is no longer available.", 409));
    if (error instanceof CheckoutInProgressError) return apiErrorResponse(new ApiError("already_taken", "This payment is already being submitted.", 409));
    if (error instanceof BanquestConfigurationError) return apiErrorResponse(new ApiError("internal", "Online payment setup is not complete.", 503));
    if (error instanceof BanquestDeclinedError) return apiErrorResponse(new ApiError("invalid_input", error.message, 402));
    if (error instanceof BanquestApiError) return apiErrorResponse(new ApiError("internal", "The payment service could not complete this request. The office will verify whether it was received before the kibbudim are released.", 502));
    return apiErrorResponse(error);
  }
}
