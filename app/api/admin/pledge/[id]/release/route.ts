import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
} from "@/lib/redis/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await getRepository().releasePledge(id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof HoldExpiredError) {
      return apiErrorResponse(
        new ApiError("hold_expired", "Pledge not found or no longer active.", 410)
      );
    }
    if (error instanceof AlreadyTakenError) {
      return apiErrorResponse(
        new ApiError("already_taken", "This pledge has already been confirmed.", 409)
      );
    }
    return apiErrorResponse(error);
  }
}

