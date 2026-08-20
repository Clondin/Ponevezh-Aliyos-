import { requireAdmin } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { reconcileBanquestTransactions } from "@/lib/banquest/reconcile";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdmin(request);
    return Response.json(await reconcileBanquestTransactions());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
