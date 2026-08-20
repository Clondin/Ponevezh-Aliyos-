import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import {
  currentItems,
  currentMinyan,
  currentOccasion,
} from "@/lib/calendar/current";
import { getRepository } from "@/lib/redis/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ minyan: string; occasion: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { minyan, occasion } = await params;
    const minyanRecord = currentMinyan(minyan);
    const occasionRecord = currentOccasion(occasion);
    const items = currentItems(minyan, occasion);
    if (!minyanRecord || !occasionRecord || !items.length) {
      throw new ApiError("not_found", "Minyan or occasion not found.", 404);
    }
    const repository = getRepository();
    const [statuses, orders, pledges] = await Promise.all([
      repository.statuses(items.map((item) => item.id)),
      repository.allOrders(),
      repository.pendingPledges(),
    ]);
    const statusById = new Map(statuses.map((status) => [status.id, status]));
    const orderByItem = new Map(orders.map((order) => [order.kibbudId, order]));
    const pledgeByItem = new Map(pledges.map((pledge) => [pledge.kibbudId, pledge]));
    const rows = items.map((item) => {
      const state = statusById.get(item.id)?.state ?? "available";
      const owner = state === "sold" ? orderByItem.get(item.id) : pledgeByItem.get(item.id);
      return {
        id: item.id,
        name: item.name,
        order: item.order,
        state,
        donorName: owner?.donorName ?? null,
        misheberachNames: owner?.misheberachNames ?? [],
      };
    });
    return Response.json({
      minyan: minyanRecord.slug,
      occasion: occasionRecord.slug,
      rows,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

