import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { emailRecord, retryEmail, sendDonorConfirmation } from "@/lib/notifications/email";
import { getRepository } from "@/lib/storage/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { id } = await params;
    let record = await retryEmail(id);
    if (!record && id.startsWith("order-confirmation-")) {
      const order = await getRepository().order(id.slice("order-confirmation-".length));
      if (order) {
        await sendDonorConfirmation(order);
        record = await emailRecord(id);
      }
    }
    if (!record) throw new ApiError("not_found", "Email record not found.", 404);
    await getRepository().appendAudit({ action: "email_retried", referenceId: id });
    return Response.json({ ok: true, status: record.status });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
