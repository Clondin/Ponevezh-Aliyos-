import { cookies } from "next/headers";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { decodeHoldCookie, HOLD_COOKIE } from "@/lib/api/hold-cookie";
import {
  assertBeforeCutoff,
  readJson,
  requireKibbud,
  sponsorPayload,
  trustedAmount,
} from "@/lib/api/validation";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
} from "@/lib/redis/repository";
import { createCheckoutSession } from "@/lib/stripe/checkout";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = sponsorPayload(await readJson(request), false);
    const item = requireKibbud(payload.kibbudId);
    assertBeforeCutoff(item);
    const holdCookie = decodeHoldCookie((await cookies()).get(HOLD_COOKIE)?.value);
    if (!holdCookie || holdCookie.kibbudId !== item.id) throw new HoldExpiredError();
    await getRepository().checkoutHold(item.id, holdCookie.token);
    const preferredMethod =
      request.headers.get("x-preferred-payment-method") === "card" ? "card" : "ach";
    const session = await createCheckoutSession(
      item,
      payload,
      holdCookie.token,
      trustedAmount(item),
      preferredMethod
    );
    return Response.json({ url: session.url });
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
    return apiErrorResponse(error);
  }
}
