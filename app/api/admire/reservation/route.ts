import { randomUUID } from "node:crypto";
import { ApiError, apiErrorResponse, invalidInput } from "@/lib/api/errors";
import { holdCookieFromRequest } from "@/lib/api/hold-cookie";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import {
  assertSaleOpen,
  readJson,
  requireKibbud,
  sponsorPayload,
  trustedAmount,
} from "@/lib/api/validation";
import { sendPledgeNotifications } from "@/lib/notifications/email";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
  PLEDGE_HOLD_SECONDS,
} from "@/lib/storage/repository";
import type { StoredPledge } from "@/lib/storage/types";

const ALLOWED_FIELDS = new Set([
  "kibbudId",
  "kibbudIds",
  "donorName",
  "email",
  "phone",
  "misheberachNames",
  "dedicationType",
  "dedicationName",
  "dedicationMessage",
  "honoreeEmail",
  "publicRecognition",
  "recognitionName",
  "assignmentAccepted",
]);

function itemIdsFrom(body: Record<string, unknown>): string[] {
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    invalidInput("Please refresh and try again.");
  }
  if (body.kibbudId != null && body.kibbudIds != null) {
    invalidInput("Please refresh and try again.");
  }
  const raw = body.kibbudIds ?? (body.kibbudId == null ? null : [body.kibbudId]);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) {
    invalidInput("Choose between 1 and 10 kibbudim.");
  }
  if (!raw.every((value) => typeof value === "string" && Boolean(value.trim()))) {
    invalidInput("Please refresh and try again.");
  }
  const itemIds = raw.map((value) => (value as string).trim());
  if (new Set(itemIds).size !== itemIds.length) {
    invalidInput("The sponsorship list contains a duplicate kibbud.");
  }
  return itemIds;
}

export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit(request, "admire-reservation", 5, 60 * 60);
    const body = await readJson(request);
    const itemIds = itemIdsFrom(body);
    const sponsor = sponsorPayload(
      {
        kibbudId: itemIds[0],
        donorName: body.donorName,
        email: body.email,
        phone: body.phone,
        misheberachNames: body.misheberachNames,
        dedicationType: body.dedicationType,
        dedicationName: body.dedicationName,
        dedicationMessage: body.dedicationMessage,
        honoreeEmail: body.honoreeEmail,
        publicRecognition: body.publicRecognition,
        recognitionName: body.recognitionName,
        assignmentAccepted: body.assignmentAccepted,
      },
      true
    );
    const items = itemIds.map(requireKibbud);
    items.forEach((item) => assertSaleOpen(item));

    const holdCookie = holdCookieFromRequest(request);
    const heldIds = holdCookie?.kibbudIds ?? (holdCookie ? [holdCookie.kibbudId] : []);
    if (
      !holdCookie ||
      heldIds.length !== itemIds.length ||
      !heldIds.every((id, index) => id === itemIds[index])
    ) {
      throw new HoldExpiredError();
    }

    const repository = getRepository();
    await Promise.all(
      itemIds.map((kibbudId) => repository.checkoutHold(kibbudId, holdCookie.token))
    );

    const now = new Date();
    const uuid = randomUUID();
    const amounts = Object.fromEntries(items.map((item) => [item.id, trustedAmount(item)]));
    const amount = Object.values(amounts).reduce((sum, value) => sum + value, 0);
    const pledge: StoredPledge = {
      id: `plg_${uuid}`,
      kibbudId: itemIds[0],
      ...(itemIds.length > 1 ? { kibbudIds: itemIds, amounts } : {}),
      donorName: sponsor.donorName,
      email: sponsor.email,
      phone: sponsor.phone,
      misheberachNames: sponsor.misheberachNames,
      dedicationType: sponsor.dedicationType,
      dedicationName: sponsor.dedicationName,
      dedicationMessage: sponsor.dedicationMessage,
      honoreeEmail: sponsor.honoreeEmail,
      publicRecognition: sponsor.publicRecognition,
      recognitionName: sponsor.recognitionName,
      assignmentAcceptedAt: now.toISOString(),
      amount,
      paymentSource: "admire",
      holdUntilReviewed: true,
      externalReference: `PNV-${uuid.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      status: "pending",
      expiresAt: new Date(now.getTime() + PLEDGE_HOLD_SECONDS * 1000).toISOString(),
      createdAt: now.toISOString(),
    };

    await repository.createPledge(pledge, holdCookie.token, true);
    await sendPledgeNotifications(pledge).catch((error) => console.error(error));
    return Response.json({
      pledgeId: pledge.id,
      reference: pledge.externalReference,
      heldUntilReviewed: true,
      amount: pledge.amount,
    });
  } catch (error) {
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(
        new ApiError(
          "already_taken",
          "One of these kibbudim was just reserved or sponsored. Please choose again.",
          409
        )
      );
    }
    if (error instanceof HoldExpiredError) {
      return apiErrorResponse(
        new ApiError(
          "hold_expired",
          "Your temporary hold expired. Please reserve the kibbudim again.",
          410
        )
      );
    }
    return apiErrorResponse(error);
  }
}
