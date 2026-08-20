import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import {
  assertBeforeCutoff,
  readJson,
  requireKibbud,
  sponsorPayload,
  trustedAmount,
} from "@/lib/api/validation";
import { notifyOfficeOfPledge } from "@/lib/notifications/email";
import {
  AlreadyTakenError,
  getRepository,
  PLEDGE_HOLD_SECONDS,
} from "@/lib/redis/repository";
import type { StoredPledge } from "@/lib/redis/types";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = sponsorPayload(await readJson(request), true);
    const item = requireKibbud(payload.kibbudId);
    assertBeforeCutoff(item);
    const now = new Date();
    const pledge: StoredPledge = {
      id: `plg_${randomUUID()}`,
      kibbudId: item.id,
      donorName: payload.donorName,
      email: payload.email,
      phone: payload.phone,
      misheberachNames: payload.misheberachNames,
      amount: trustedAmount(item),
      status: "pending",
      expiresAt: new Date(now.getTime() + PLEDGE_HOLD_SECONDS * 1000).toISOString(),
      createdAt: now.toISOString(),
    };
    await getRepository().createPledge(pledge, randomUUID());
    await notifyOfficeOfPledge(pledge).catch((error) => console.error(error));
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

