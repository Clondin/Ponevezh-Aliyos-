import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { sendDonorConfirmation } from "@/lib/notifications/email";
import { getRepository, HoldExpiredError } from "@/lib/redis/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const order = await getRepository().confirmPledge(id);
    await sendDonorConfirmation(order).catch((error) => console.error(error));
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

