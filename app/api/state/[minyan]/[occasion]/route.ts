import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import {
  currentItems,
  currentMinyan,
  currentOccasion,
} from "@/lib/calendar/current";
import { getRepository } from "@/lib/storage/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ minyan: string; occasion: string }> }
): Promise<Response> {
  try {
    const { minyan, occasion } = await params;
    const minyanRecord = currentMinyan(minyan);
    const occasionRecord = currentOccasion(occasion);
    const items = currentItems(minyan, occasion);
    if (!minyanRecord || !occasionRecord || !items.length) {
      throw new ApiError("not_found", "Minyan or occasion not found.", 404);
    }
    const statuses = await getRepository().statuses(items.map((item) => item.id));
    return Response.json({
      minyan: minyanRecord.slug,
      occasion: occasionRecord.slug,
      asOf: new Date().toISOString(),
      cutoffISO: occasionRecord.cutoffISO,
      statuses,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
