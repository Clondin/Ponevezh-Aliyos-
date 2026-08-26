import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { sendOrderNotifications } from "@/lib/notifications/email";
import { getRepository, HoldExpiredError } from "@/lib/storage/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const orders = await getRepository().confirmPledgeGroup(id);
    await Promise.all(
      orders.map((order) => sendOrderNotifications(order).catch((error) => console.error(error)))
    );
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
