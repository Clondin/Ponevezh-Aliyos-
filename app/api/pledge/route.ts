import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { holdCookieFromRequest } from "@/lib/api/hold-cookie";
import {
  assertSaleOpen,
  readJson,
  requireKibbud,
  sponsorPayload,
  trustedAmount,
} from "@/lib/api/validation";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { sendPledgeNotifications } from "@/lib/notifications/email";
import {
  AlreadyTakenError,
  getRepository,
  PLEDGE_HOLD_SECONDS,
} from "@/lib/storage/repository";
import type { StoredPledge } from "@/lib/storage/types";

export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit(request, "pledge", 5, 60 * 60);
    const payload = sponsorPayload(await readJson(request), true);
    const item = requireKibbud(payload.kibbudId);
    assertSaleOpen(item);
    const now = new Date();
    const pledge: StoredPledge = {
      id: `plg_${randomUUID()}`,
      kibbudId: item.id,
      donorName: payload.donorName,
      email: payload.email,
      phone: payload.phone,
      misheberachNames: payload.misheberachNames,
      dedicationType: payload.dedicationType,
      dedicationName: payload.dedicationName,
      dedicationMessage: payload.dedicationMessage,
      honoreeEmail: payload.honoreeEmail,
      publicRecognition: payload.publicRecognition,
      recognitionName: payload.recognitionName,
      amount: trustedAmount(item),
      status: "pending",
      expiresAt: new Date(now.getTime() + PLEDGE_HOLD_SECONDS * 1000).toISOString(),
      createdAt: now.toISOString(),
    };
    const holdCookie = holdCookieFromRequest(request);
    const fromCheckoutHold = holdCookie?.kibbudId === item.id;
    await getRepository().createPledge(
      pledge,
      fromCheckoutHold ? holdCookie.token : randomUUID(),
      fromCheckoutHold
    );
    await sendPledgeNotifications(pledge).catch((error) => console.error(error));
    return Response.json({ pledgeId: pledge.id, expiresAt: pledge.expiresAt });
  } catch (error) {
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(
        new ApiError("already_taken", "This kibbud is already reserved or sponsored.", 409)
      );
    }
    return apiErrorResponse(error);
  }
}
