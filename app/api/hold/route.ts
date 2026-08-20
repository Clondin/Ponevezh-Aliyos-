import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import {
  encodeHoldCookie,
  holdCookieFromRequest,
  HOLD_COOKIE,
} from "@/lib/api/hold-cookie";
import {
  assertBeforeCutoff,
  readJson,
  readKibbudId,
  requireKibbud,
} from "@/lib/api/validation";
import {
  AlreadyTakenError,
  CHECKOUT_HOLD_SECONDS,
  getRepository,
} from "@/lib/redis/repository";

export async function POST(request: Request): Promise<Response> {
  try {
    const kibbudId = readKibbudId(await readJson(request));
    const item = requireKibbud(kibbudId);
    assertBeforeCutoff(item);
    const repository = getRepository();
    const previous = holdCookieFromRequest(request);
    if (previous?.kibbudId === kibbudId) {
      try {
        const existing = await repository.holdOwnedBy(kibbudId, previous.token);
        return NextResponse.json({ kibbudId, expiresAt: existing.expiresAt });
      } catch {
        // The cookie outlived its Redis hold; create a fresh hold below.
      }
    } else if (previous) {
      await repository.releaseHold(previous.kibbudId, previous.token);
    }
    const token = randomUUID();
    const hold = await repository.acquireHold(kibbudId, token);
    const response = NextResponse.json({ kibbudId, expiresAt: hold.expiresAt });
    response.cookies.set(HOLD_COOKIE, encodeHoldCookie({ kibbudId, token }), {
      httpOnly: true,
      maxAge: CHECKOUT_HOLD_SECONDS,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(
        new ApiError("already_taken", "This kibbud is already reserved or sponsored.", 409)
      );
    }
    return apiErrorResponse(error);
  }
}
