import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { getRepository, HoldExpiredError } from "@/lib/storage/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await getRepository().confirmPledgeGroup(id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof HoldExpiredError) {
      return apiErrorResponse(
        new ApiError("hold_expired", "Pledge not found or no longer active.", 410)
      );
    }
    return apiErrorResponse(error);
  }
}
