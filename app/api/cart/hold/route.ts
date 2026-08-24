import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, invalidInput } from "@/lib/api/errors";
import { encodeHoldCookie, holdCookieFromRequest, HOLD_COOKIE } from "@/lib/api/hold-cookie";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { verifyTurnstile } from "@/lib/api/turnstile";
import { assertSaleOpen, readJson, requireKibbud } from "@/lib/api/validation";
import {
  AlreadyTakenError,
  CHECKOUT_HOLD_SECONDS,
  getRepository,
  HoldExpiredError,
} from "@/lib/storage/repository";

function idsFrom(body: Record<string, unknown>): string[] {
  if (Object.keys(body).some((key) => key !== "kibbudIds") || !Array.isArray(body.kibbudIds)) {
    invalidInput("kibbudIds must be an array.");
  }
  if (
    !body.kibbudIds.every(
      (value): value is string => typeof value === "string" && Boolean(value.trim())
    )
  ) {
    invalidInput("Every kibbud ID must be a non-empty string.");
  }
  const ids = body.kibbudIds.map((value) => value.trim());
  if (ids.length < 2 || ids.length > 10 || new Set(ids).size !== ids.length) {
    invalidInput("Choose between 2 and 10 distinct kibbudim.");
  }
  return ids;
}

export async function POST(request: Request): Promise<Response> {
  const repository = getRepository();
  let acquired: string[] = [];
  let token = "";
  try {
    await enforceRateLimit(request, "cart-hold", 10, 10 * 60);
    await verifyTurnstile(request, request.headers.get("x-turnstile-token"), "reserve_kibbud");
    const kibbudIds = idsFrom(await readJson(request));
    const items = kibbudIds.map(requireKibbud);
    items.forEach((item) => assertSaleOpen(item));
    const previous = holdCookieFromRequest(request);
    const previousIds = previous?.kibbudIds ?? (previous ? [previous.kibbudId] : []);
    if (
      previous &&
      previousIds.length === kibbudIds.length &&
      previousIds.every((id, index) => id === kibbudIds[index])
    ) {
      try {
        const holds = await Promise.all(
          kibbudIds.map((id) => repository.holdOwnedBy(id, previous.token))
        );
        return Response.json({
          kibbudIds,
          expiresAt: holds.map((hold) => hold.expiresAt).sort()[0],
        });
      } catch (error) {
        if (!(error instanceof HoldExpiredError)) throw error;
        await Promise.all(
          previousIds.map((id) => repository.releaseHold(id, previous.token))
        );
      }
    }
    if (previous) await Promise.all(previousIds.map((id) => repository.releaseHold(id, previous.token)));
    token = randomUUID();
    for (const id of kibbudIds) {
      await repository.acquireHold(id, token);
      acquired.push(id);
    }
    const holds = await Promise.all(kibbudIds.map((id) => repository.holdOwnedBy(id, token)));
    const response = NextResponse.json({ kibbudIds, expiresAt: holds.map((hold) => hold.expiresAt).sort()[0] });
    response.cookies.set(HOLD_COOKIE, encodeHoldCookie({ kibbudId: kibbudIds[0], kibbudIds, token }), {
      httpOnly: true,
      maxAge: CHECKOUT_HOLD_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (token && acquired.length) await Promise.all(acquired.map((id) => repository.releaseHold(id, token)));
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(new ApiError("already_taken", "One of these kibbudim was just reserved or sponsored. Refresh your list and try again.", 409));
    }
    return apiErrorResponse(error);
  }
}
